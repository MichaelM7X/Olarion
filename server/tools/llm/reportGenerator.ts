import { AuditRequest, AuditFinding } from "../../../src/types";
import { callOpenAIJson } from "../../openaiClient";

export interface ReportResult {
  executive_summary: string;
  full_report: string;
}

export async function generateNarrativeReport(
  request: AuditRequest,
  findings: AuditFinding[],
  overallRisk: string,
): Promise<ReportResult> {
  const findingsJson = JSON.stringify(
    findings.map((f) => ({
      feature: f.flagged_object,
      type: f.macro_bucket,
      severity: f.severity,
      evidence: f.evidence.map((e) => typeof e === "string" ? e : e.claim ?? String(e)),
      fix: f.fix_recommendation,
    })),
    null,
    2,
  );

  const systemPrompt = `You are a senior data scientist writing an audit report.
Return a JSON object with exactly two fields:

1. "executive_summary": A concise high-level summary (3-5 bullet points, ~150 words).
   Each bullet starts with "• ". Include:
   - Overall verdict with risk level and issue counts
   - The top 2-3 most critical/high-severity findings with specific feature names
   - One sentence on recommended next steps
   Use \\n between bullets.

2. "full_report": The complete narrative report explaining each finding, its evidence,
   why it matters, and how to fix it. Write as if doing a code review for a colleague.
   Be direct, specific, and concise. Keep it under 500 words. Use \\n for line breaks.
   Do not use markdown headers.

Return ONLY valid JSON. No markdown fences.`;

  const userPrompt = `Prediction task: ${request.prediction_goal}
Target: ${request.target_column}
Overall risk: ${overallRisk.toUpperCase()}

Findings:
${findingsJson}

Generate the executive summary and full audit report.`;

  try {
    const result = await callOpenAIJson(systemPrompt, userPrompt);
    console.log("[reportGenerator] Raw LLM result keys:", Object.keys(result));
    console.log("[reportGenerator] executive_summary length:", typeof result.executive_summary === "string" ? result.executive_summary.length : "NOT A STRING", typeof result.executive_summary);
    console.log("[reportGenerator] full_report length:", typeof result.full_report === "string" ? result.full_report.length : "NOT A STRING", typeof result.full_report);

    const execSummary =
      typeof result.executive_summary === "string"
        ? result.executive_summary
        : "";
    const fullReport =
      typeof result.full_report === "string" ? result.full_report : "";

    if (!fullReport) {
      console.error("[reportGenerator] full_report is empty. Full result:", JSON.stringify(result).slice(0, 500));
      throw new Error("Missing full_report in LLM response");
    }

    return { executive_summary: execSummary, full_report: fullReport };
  } catch (error) {
    console.error("[reportGenerator] Failed, falling back:", error);
    return { executive_summary: "", full_report: "Report generation failed. Please review the structured findings." };
  }
}
