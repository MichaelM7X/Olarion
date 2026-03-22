import { AuditRequest, AuditReport, AuditFinding } from "../src/types";
import { pipelineScan } from "./tools/rules/pipelineScan";
import { metadataCheck } from "./tools/rules/metadataCheck";
import { structuralCheck } from "./tools/rules/structuralCheck";
import { detectProxyLeakage } from "./tools/llm/proxyDetector";
import { detectTemporalLeakage } from "./tools/llm/temporalDetector";
import {
  auditPreprocessingCode,
  CodeAuditResult,
} from "./tools/llm/codeAuditor";
import { reviewAgent } from "./tools/llm/reviewAgent";
import { generateNarrativeReport } from "./tools/llm/reportGenerator";
import {
  dedupeFindings,
  computeOverallRisk,
  computeSafeFeatures,
} from "./utils";

export async function runAudit(request: AuditRequest): Promise<AuditReport> {
  const findings: AuditFinding[] = [];

  // ============================================
  // Phase 1: Fixed orchestration (deterministic)
  // ============================================

  // Step 1: rule-engine tools (synchronous)
  findings.push(...pipelineScan(request));
  findings.push(...metadataCheck(request));

  // Step 2: LLM tools (parallel)
  const [proxyFindings, temporalFindings] = await Promise.all([
    detectProxyLeakage(request),
    detectTemporalLeakage(request),
  ]);
  findings.push(...proxyFindings);
  findings.push(...temporalFindings);

  // Step 3: optional code audit
  let codeAuditResult: CodeAuditResult | null = null;
  if (request.preprocessing_code) {
    codeAuditResult = await auditPreprocessingCode(request);
    findings.push(...codeAuditResult.findings);
  }

  // Step 4: structural check
  findings.push(...structuralCheck(request, codeAuditResult));

  const phase1Findings = dedupeFindings(findings);

  // ============================================
  // Phase 2: Review Agent (autonomous decisions)
  // ============================================

  let additionalFindings: AuditFinding[] = [];
  try {
    additionalFindings = await reviewAgent(request, phase1Findings);
  } catch (error) {
    console.error(
      "Review agent failed, continuing with Phase 1 results:",
      error,
    );
  }

  // ============================================
  // Phase 3: Final aggregation
  // ============================================

  const allFindings = dedupeFindings([
    ...phase1Findings,
    ...additionalFindings,
  ]);
  const overallRisk = computeOverallRisk(allFindings);
  const safeFeatures = computeSafeFeatures(
    request.feature_dictionary,
    allFindings,
  );

  const narrative = await generateNarrativeReport(
    request,
    allFindings,
    overallRisk,
    safeFeatures,
  );

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

  const fixPlan = [
    ...new Set(allFindings.flatMap((f) => f.fix_recommendation)),
  ].slice(0, 8);

  const clarifyingQuestions = [
    ...new Set([
      ...missingMetadata.map((field) =>
        field === "timestamp_fields"
          ? "Which columns define feature time, prediction cutoff, and outcome time?"
          : "Which stable entity key should validation group on?",
      ),
      ...allFindings
        .filter((f) => f.needs_human_review)
        .map(
          (f) =>
            `Can a human reviewer confirm when ${f.flagged_object} becomes available relative to the prediction boundary?`,
        ),
    ]),
  ];

  return {
    overall_risk: overallRisk,
    summary: `Audit complete. Overall risk: ${overallRisk.toUpperCase()}. Found ${allFindings.length} issue(s). Review agent ${additionalFindings.length > 0 ? `added ${additionalFindings.length} additional finding(s)` : "confirmed initial assessment"}.`,
    narrative_report: narrative,
    findings: allFindings,
    safe_features: safeFeatures,
    missing_metadata: [...new Set(missingMetadata)],
    clarifying_questions,
    fix_plan: fixPlan,
    bucket_summary: bucketSummary,
  };
}
