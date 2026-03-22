import { AuditRequest, AuditFinding, EvidenceItem } from "../../../src/types";
import { callOpenAIJson } from "../../openaiClient";
import { resolveLineLocation, extractSnippet } from "../../utils";

export interface CodeAuditResult {
  split_method: string | null;
  detected_entity_keys: string[];
  findings: AuditFinding[];
}

const CODE_AUDIT_RULE_CITED =
  "Train/test split must precede all data transformations (sklearn pipeline best practice)";

function severityRationale(severity: string): string {
  switch (severity) {
    case "critical":
      return "Critical: this issue directly compromises model validity";
    case "high":
      return "High: substantial risk to unbiased evaluation and reliable deployment metrics";
    case "medium":
      return "Medium: may skew train/test behavior or obscure subtler leakage";
    case "low":
      return "Low: smaller impact on validity but still worth addressing for rigor";
    default:
      return "Severity reflects estimated impact on data leakage and model validity.";
  }
}

export async function auditPreprocessingCode(
  request: AuditRequest,
): Promise<CodeAuditResult> {
  const columnList = request.csv_columns.join(", ");

  const systemPrompt = `You are an expert ML code auditor. Analyze preprocessing code 
to detect data leakage issues.

Based on the CSV column names and preprocessing code, also identify:
- The train/test split method used
- Which columns are likely entity/group ID columns (e.g. user_id, patient_id, loan_id)

You must respond with ONLY valid JSON.`;

  const userPrompt = `Prediction task: ${request.prediction_goal}
Target column: ${request.target_column}
CSV columns: ${columnList}

Preprocessing code:

\`\`\`python
${request.preprocessing_code}
\`\`\`

Analyze this code and answer:
1. What is the train/test split method? (random / time-based / group-based / unknown)
2. Which columns appear to be entity/group ID columns that should be used for grouped splitting?
3. Is any preprocessing (scaling, encoding, imputation) fitted on the full dataset before splitting?
4. Are there aggregation features computed using data that might include future observations?
5. Any other data leakage concerns?

Respond in this exact JSON format:
{
  "split_method": "random" or "time-based" or "group-based" or "unknown",
  "detected_entity_keys": ["column_name_1", "column_name_2"],
  "issues": [
    {
      "description": "what the issue is",
      "code_reference": "the relevant line or pattern",
      "leakage_type": "structural" or "temporal" or "preprocessing",
      "severity": "critical" or "high" or "medium" or "low",
      "evidence": [
        {
          "claim": "one concrete factual observation supporting your reasoning",
          "source": {
            "filename": "preprocessing_code.py",
            "location": "specific line or pattern (e.g. line 42, fit_transform call)"
          }
        }
      ]
    }
  ]
}`;

  const result = await callOpenAIJson(systemPrompt, userPrompt);

  if (!result.issues && !result.split_method) {
    return {
      split_method: null,
      detected_entity_keys: [],
      findings: [
        {
          id: "diagnostic-code-auditor",
          title: "Preprocessing code audit returned an empty or incomplete response",
          macro_bucket: "Structure / pipeline leakage",
          fine_grained_type: "evaluation",
          severity: "medium",
          severity_rationale: severityRationale("medium"),
          confidence: "low",
          flagged_object: "LLM preprocessing code audit",
          rule_cited: CODE_AUDIT_RULE_CITED,
          evidence: [
            {
              claim:
                "The model response did not include both `issues` and `split_method`; the audit could not be completed reliably.",
              source: {
                filename: "preprocessing_code.py",
                location: resolveLineLocation(
                  request.preprocessing_code,
                  "preprocessing_code.py",
                  "",
                ),
              },
            },
          ],
          why_it_matters:
            "Without a structured audit result, preprocessing leakage may go undetected.",
          fix_recommendation: [
            "Retry the audit after checking API connectivity.",
            "Manually verify that train/test split happens before any fit/transform on the full data.",
          ],
          needs_human_review: true,
        },
      ],
    };
  }

  const issues = (result.issues as Array<Record<string, unknown>>) ?? [];

  const bucketMap: Record<string, string> = {
    structural: "Structure / pipeline leakage",
    temporal: "Time leakage",
    preprocessing: "Structure / pipeline leakage",
  };

  const code = request.preprocessing_code ?? "";
  const findings: AuditFinding[] = issues.map((issue, i) => {
    const sev = String(issue.severity ?? "medium") as AuditFinding["severity"];
    const rawEvidence = (issue.evidence as Array<Record<string, unknown>>) ?? [];
    const evidence: EvidenceItem[] =
      rawEvidence.length > 0
        ? rawEvidence.map((e) => {
            const src = (e.source as Record<string, unknown>) ?? {};
            const keyword = String(
              (src.location as string) ?? issue.code_reference ?? "",
            );
            return {
              claim: String((e.claim as string) ?? issue.description ?? "Issue detected"),
              source: {
                filename: String(src.filename ?? "preprocessing_code.py"),
                location: resolveLineLocation(
                  request.preprocessing_code,
                  "preprocessing_code.py",
                  keyword,
                ),
                snippet: extractSnippet(code, keyword),
              },
            };
          })
        : [
            {
              claim: `Code analysis found: ${issue.description}`,
              source: {
                filename: "preprocessing_code.py",
                location: resolveLineLocation(
                  request.preprocessing_code,
                  "preprocessing_code.py",
                  String(issue.code_reference ?? ""),
                ),
                snippet: extractSnippet(code, String(issue.code_reference ?? "")),
              },
            },
          ];

    return {
      id: `code-audit-${i}`,
      title: String(issue.description ?? "Code issue detected"),
      macro_bucket: (bucketMap[String(issue.leakage_type ?? "")] ??
        "Structure / pipeline leakage") as AuditFinding["macro_bucket"],
      fine_grained_type: "evaluation" as AuditFinding["fine_grained_type"],
      severity: sev,
      severity_rationale: severityRationale(sev),
      confidence: "high" as AuditFinding["confidence"],
      flagged_object: String(issue.code_reference ?? "preprocessing code"),
      rule_cited: CODE_AUDIT_RULE_CITED,
      evidence,
      why_it_matters: "Code-level leakage is concrete and verifiable.",
      fix_recommendation: ["Fix the identified issue in your preprocessing pipeline."],
      needs_human_review: false,
    };
  });

  return {
    split_method: String(result.split_method ?? null),
    detected_entity_keys: (result.detected_entity_keys as string[]) ?? [],
    findings,
  };
}
