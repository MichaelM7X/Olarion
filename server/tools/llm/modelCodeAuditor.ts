import { AuditRequest, AuditFinding, EvidenceItem } from "../../../src/types";
import { callOpenAIJson } from "../../openaiClient";
import { resolveLineLocation } from "../../utils";

const MODEL_AUDIT_RULE_CITED =
  "Model training pipeline must not use test data for feature selection or hyperparameter tuning";

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

export async function auditModelTrainingCode(
  request: AuditRequest,
): Promise<AuditFinding[]> {
  if (!request.model_training_code) return [];

  const columnList = request.csv_columns.join(", ");

  const systemPrompt = `You are an expert ML code auditor. Analyze model training code 
to detect data leakage and methodological issues.

Focus on:
- Feature selection or feature importance computed on the full dataset before splitting
- Hyperparameter tuning that uses test data
- Validation design issues (e.g. not using grouped or time-aware CV)
- Target leakage through feature engineering in the training pipeline

You must respond with ONLY valid JSON.`;

  const userPrompt = `Prediction task: ${request.prediction_goal}
Target column: ${request.target_column}
CSV columns: ${columnList}

Model training code:

\`\`\`python
${request.model_training_code}
\`\`\`

${request.preprocessing_code ? `Preprocessing code (for context):\n\n\`\`\`python\n${request.preprocessing_code}\n\`\`\`` : ""}

Analyze this training code for:
1. Is feature selection (SelectKBest, RFE, feature_importances_) done on the full dataset before splitting?
2. Is hyperparameter tuning (GridSearchCV, RandomizedSearchCV) using a proper validation strategy?
3. Does the validation split respect entity boundaries and time ordering?
4. Are there any other leakage or methodological issues?

Respond in this exact JSON format:
{
  "issues": [
    {
      "description": "what the issue is",
      "code_reference": "the relevant line or pattern",
      "leakage_type": "feature_selection" or "validation" or "preprocessing" or "other",
      "severity": "critical" or "high" or "medium" or "low",
      "evidence": [
        {
          "claim": "one concrete factual observation",
          "source": {
            "filename": "model_training_code.py",
            "location": "specific line or pattern (e.g. line 15, SelectKBest call)"
          }
        }
      ]
    }
  ]
}`;

  const result = await callOpenAIJson(systemPrompt, userPrompt);

  if (!result.issues) {
    const code = request.model_training_code ?? "";
    return [
      {
        id: "diagnostic-model-auditor",
        title: "Model training code audit returned an empty or incomplete response",
        macro_bucket: "Structure / pipeline leakage",
        fine_grained_type: "evaluation",
        severity: "medium",
        severity_rationale: severityRationale("medium"),
        confidence: "low",
        flagged_object: "LLM model training code audit",
        rule_cited: MODEL_AUDIT_RULE_CITED,
        evidence: [
          {
            claim:
              "The model response did not include an `issues` array; the training-code audit could not be completed reliably.",
            source: {
              filename: "model_training_code.py",
              location: resolveLineLocation(code, "model_training_code.py", ""),
            },
          },
        ],
        why_it_matters:
          "Without a structured audit result, training-pipeline leakage may go undetected.",
        fix_recommendation: [
          "Retry the audit after checking API connectivity.",
          "Manually verify that feature selection and tuning use only training/validation splits.",
        ],
        needs_human_review: true,
      },
    ];
  }

  const issues = (result.issues as Array<Record<string, unknown>>) ?? [];

  const trainingCode = request.model_training_code ?? "";
  return issues.map((issue, i) => {
    const sev = String(issue.severity ?? "medium") as AuditFinding["severity"];
    const code = request.model_training_code ?? "";
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
                filename: String(src.filename ?? "model_training_code.py"),
                location: resolveLineLocation(code, "model_training_code.py", keyword),
              },
            };
          })
        : [
            {
              claim: `Training code analysis found: ${issue.description}`,
              source: {
                filename: "model_training_code.py",
                location: resolveLineLocation(
                  code,
                  "model_training_code.py",
                  String(issue.code_reference ?? ""),
                ),
              },
            },
          ];

    return {
      id: `model-audit-${i}`,
      title: String(issue.description ?? "Training code issue detected"),
      macro_bucket: "Structure / pipeline leakage" as AuditFinding["macro_bucket"],
      fine_grained_type: "evaluation" as AuditFinding["fine_grained_type"],
      severity: sev,
      severity_rationale: severityRationale(sev),
      confidence: "high" as AuditFinding["confidence"],
      flagged_object: String(issue.code_reference ?? "training code"),
      rule_cited: MODEL_AUDIT_RULE_CITED,
      evidence,
      why_it_matters:
        "Training pipeline leakage can inflate validation metrics and hide real performance.",
      fix_recommendation: ["Fix the identified issue in your model training pipeline."],
      needs_human_review: false,
    };
  });
}
