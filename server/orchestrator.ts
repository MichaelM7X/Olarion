import { AuditRequest, AuditReport, AuditFinding } from "../src/types";
import { pipelineScan } from "./tools/rules/pipelineScan";
import { structuralCheck } from "./tools/rules/structuralCheck";
import { detectProxyLeakage } from "./tools/llm/proxyDetector";
import { detectTemporalLeakage } from "./tools/llm/temporalDetector";
import {
  auditPreprocessingCode,
  CodeAuditResult,
} from "./tools/llm/codeAuditor";
import { auditModelTrainingCode } from "./tools/llm/modelCodeAuditor";
import { reviewAgent } from "./tools/llm/reviewAgent";
import { generateNarrativeReport } from "./tools/llm/reportGenerator";
import { dedupeFindings, computeOverallRisk } from "./utils";

export interface ProgressEvent {
  type: "step";
  id: string;
  status: "running" | "done" | "skipped";
  title: string;
  detail?: string;
}

type ProgressCallback = (event: ProgressEvent) => void;

function noop() {}

export async function runAudit(
  request: AuditRequest,
  onProgress: ProgressCallback = noop,
): Promise<AuditReport> {
  const findings: AuditFinding[] = [];

  // Step 1: pipeline scan
  onProgress({ type: "step", id: "pipeline-scan", status: "running", title: "Scanning preprocessing pipeline" });
  const pipelineFindings = pipelineScan(request);
  onProgress({
    type: "step", id: "pipeline-scan", status: "done", title: "Scanning preprocessing pipeline",
    detail: pipelineFindings.length > 0 ? `Found ${pipelineFindings.length} pipeline issue(s)` : "No pipeline issues detected",
  });
  findings.push(...pipelineFindings);

  // Step 2: proxy + temporal detectors (parallel)
  onProgress({ type: "step", id: "proxy-detector", status: "running", title: "Detecting proxy leakage" });
  onProgress({ type: "step", id: "temporal-detector", status: "running", title: "Detecting temporal leakage" });

  const [proxyFindings, temporalFindings] = await Promise.all([
    detectProxyLeakage(request),
    detectTemporalLeakage(request),
  ]);

  onProgress({
    type: "step", id: "proxy-detector", status: "done", title: "Detecting proxy leakage",
    detail: proxyFindings.length > 0 ? `Flagged ${proxyFindings.length} proxy feature(s)` : "No proxy leakage found",
  });
  onProgress({
    type: "step", id: "temporal-detector", status: "done", title: "Detecting temporal leakage",
    detail: temporalFindings.length > 0 ? `Flagged ${temporalFindings.length} temporal issue(s)` : "No temporal leakage found",
  });
  findings.push(...proxyFindings);
  findings.push(...temporalFindings);

  // Step 3: code audit
  onProgress({ type: "step", id: "code-auditor", status: "running", title: "Auditing preprocessing code" });
  let codeAuditResult: CodeAuditResult | null = null;
  codeAuditResult = await auditPreprocessingCode(request);
  onProgress({
    type: "step", id: "code-auditor", status: "done", title: "Auditing preprocessing code",
    detail: `Found ${codeAuditResult.findings.length} code issue(s), split: ${codeAuditResult.split_method ?? "unknown"}`,
  });
  findings.push(...codeAuditResult.findings);

  // Step 4: model training code audit
  if (request.model_training_code) {
    onProgress({ type: "step", id: "model-auditor", status: "running", title: "Auditing model training code" });
    const modelFindings = await auditModelTrainingCode(request);
    onProgress({
      type: "step", id: "model-auditor", status: "done", title: "Auditing model training code",
      detail: modelFindings.length > 0 ? `Found ${modelFindings.length} training issue(s)` : "No training code issues",
    });
    findings.push(...modelFindings);
  } else {
    onProgress({ type: "step", id: "model-auditor", status: "skipped", title: "Auditing model training code", detail: "No training code provided" });
  }

  // Step 5: structural check
  onProgress({ type: "step", id: "structural-check", status: "running", title: "Checking data structure" });
  const structFindings = structuralCheck(request, codeAuditResult);
  onProgress({
    type: "step", id: "structural-check", status: "done", title: "Checking data structure",
    detail: structFindings.length > 0 ? `Found ${structFindings.length} structural issue(s)` : "Structure looks clean",
  });
  findings.push(...structFindings);

  const phase1Findings = dedupeFindings(findings);

  // Step 6: Review Agent
  onProgress({
    type: "step", id: "review-agent", status: "running", title: "Review Agent analyzing findings",
    detail: `Reviewing ${phase1Findings.length} findings from Phase 1…`,
  });

  let additionalFindings: AuditFinding[] = [];
  try {
    additionalFindings = await reviewAgent(request, phase1Findings);
  } catch (error) {
    console.error("Review agent failed, continuing with Phase 1 results:", error);
  }

  onProgress({
    type: "step", id: "review-agent", status: "done", title: "Review Agent analyzing findings",
    detail: additionalFindings.length > 0
      ? `Added ${additionalFindings.length} additional finding(s)`
      : "Confirmed initial assessment — no additional issues",
  });

  // Step 7: Report generation
  const allFindings = dedupeFindings([...phase1Findings, ...additionalFindings]);
  const overallRisk = computeOverallRisk(allFindings);

  onProgress({ type: "step", id: "report-gen", status: "running", title: "Generating narrative report" });
  const { executive_summary, full_report } = await generateNarrativeReport(request, allFindings, overallRisk);
  onProgress({
    type: "step", id: "report-gen", status: "done", title: "Generating narrative report",
    detail: `Overall risk: ${overallRisk.toUpperCase()}, ${allFindings.length} total finding(s)`,
  });

  const bucketSummary = {
    "Time leakage": 0,
    "Feature / proxy leakage": 0,
    "Structure / pipeline leakage": 0,
  };
  for (const f of allFindings) {
    if (f.macro_bucket in bucketSummary) {
      bucketSummary[f.macro_bucket as keyof typeof bucketSummary] += 1;
    }
  }

  const missingMetadata = allFindings
    .filter((f) => f.fine_grained_type === "missing_metadata")
    .map((f) => f.flagged_object);

  const clarifyingQuestions = [
    ...new Set(
      allFindings
        .filter((f) => f.needs_human_review)
        .map(
          (f) =>
            `Can a human reviewer confirm when ${f.flagged_object} becomes available relative to the prediction boundary?`,
        ),
    ),
  ];

  return {
    overall_risk: overallRisk,
    summary: `Audit complete. Overall risk: ${overallRisk.toUpperCase()}. Found ${allFindings.length} issue(s). Review agent ${additionalFindings.length > 0 ? `added ${additionalFindings.length} additional finding(s)` : "confirmed initial assessment"}.`,
    executive_summary,
    narrative_report: full_report,
    findings: allFindings,
    missing_metadata: [...new Set(missingMetadata)],
    clarifying_questions: clarifyingQuestions,
    bucket_summary: bucketSummary,
  };
}
