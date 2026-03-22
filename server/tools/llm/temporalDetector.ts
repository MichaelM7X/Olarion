import { AuditRequest, AuditFinding, EvidenceItem } from "../../../src/types";
import { callOpenAIJson } from "../../openaiClient";
import { validateFeatureNames } from "../../utils";

const RULE_CITED =
  "All features must predate the prediction boundary (temporal integrity constraint)";

function isMalformedAnalysisResult(result: Record<string, unknown>): boolean {
  if (!result || typeof result !== "object" || Array.isArray(result)) return true;
  if (Object.keys(result).length === 0) return true;
  if (!("analysis" in result)) return true;
  if (!Array.isArray(result.analysis)) return true;
  return false;
}

function diagnosticTemporalFinding(): AuditFinding {
  return {
    id: "diagnostic-temporal-detector",
    title: "Temporal detection could not complete — manual review needed",
    macro_bucket: "Time leakage",
    fine_grained_type: "temporal",
    severity: "medium",
    severity_rationale:
      "Unable to assess — LLM analysis returned no results",
    confidence: "low",
    flagged_object: "temporal detection tool",
    evidence: [
      {
        claim: "OpenAI API returned empty or malformed response.",
        source: { filename: "system", location: "temporalDetector" },
      },
    ],
    rule_cited: RULE_CITED,
    escalate_reason:
      "Automated temporal analysis could not complete. A human reviewer should manually inspect features for future-data use.",
    why_it_matters:
      "Temporal leakage check was inconclusive — issues may exist but were not detected.",
    fix_recommendation: [
      "Manually review each feature and preprocessing step for use of information after the prediction time.",
    ],
    needs_human_review: true,
  };
}

export async function detectTemporalLeakage(
  request: AuditRequest,
): Promise<AuditFinding[]> {
  const featureColumns = request.csv_columns.filter(
    (c) => c !== request.target_column,
  );
  const featureList = featureColumns.map((f) => `- ${f}`).join("\n");

  const systemPrompt = `You are an expert ML auditor specializing in temporal data leakage.
Analyze each feature column to determine if its computation might use data from after the 
prediction time point.

Based on the prediction task description and the preprocessing code, infer when the 
prediction happens, then determine if each feature could contain future information.

You must respond with ONLY valid JSON.`;

  const userPrompt = `Prediction task: ${request.prediction_goal}

Feature columns to analyze:
${featureList}

Preprocessing code context:
${request.preprocessing_code}

For each feature, determine:
1. Could this feature's value include information from after the inferred prediction time point?
2. Does the feature name suggest aggregations (mean, sum, count, total, avg) that might span beyond the prediction boundary?
3. Is the feature only knowable after the outcome has occurred?

Respond in this exact JSON format:
{
  "analysis": [
    {
      "feature_name": "...",
      "has_temporal_leakage": true or false,
      "reasoning": "one sentence explanation",
      "confidence": "high" or "medium" or "low",
      "evidence": [
        {
          "claim": "one concrete factual observation",
          "source": {
            "filename": "dataset.csv",
            "location": "column name or relevant code location (e.g. column 'feature_name', or preprocessing_code.py line 23)"
          }
        }
      ]
    }
  ]
}`;

  const result = await callOpenAIJson(systemPrompt, userPrompt);
  if (isMalformedAnalysisResult(result)) {
    return [diagnosticTemporalFinding()];
  }

  const analysis = result.analysis as Array<Record<string, unknown>>;
  const flaggedItems = analysis.filter(
    (item) => item.has_temporal_leakage === true,
  );
  const flaggedNames = flaggedItems.map((item) =>
    String(item.feature_name ?? ""),
  );
  const { valid: validFeatureNames } = validateFeatureNames(
    flaggedNames,
    request.csv_columns,
  );
  const validSet = new Set(validFeatureNames);

  const findings: AuditFinding[] = [];

  for (const item of flaggedItems) {
    const featureName = String(item.feature_name ?? "unknown");
    if (!validSet.has(featureName)) continue;

    const conf = String(item.confidence ?? "medium");
    const severity: AuditFinding["severity"] =
      conf === "high" ? "high" : "medium";

    const severityRationaleByConf: Record<string, string> = {
      high:
        "High confidence that this feature may incorporate information from after the prediction boundary.",
      medium:
        "Moderate concern that lookahead or post-boundary data may affect this feature.",
      low:
        "Low-confidence flag; possible future-data use requires human verification.",
    };

    const rawEvidence = (item.evidence as Array<Record<string, unknown>>) ?? [];
    const evidence: EvidenceItem[] =
      rawEvidence.length > 0
        ? rawEvidence.map((e) => ({
            claim: String(
              (e.claim as string) ??
                item.reasoning ??
                "Temporal leakage risk detected",
            ),
            source: {
              filename: String(
                ((e.source as Record<string, unknown>)?.filename) ??
                  "dataset.csv",
              ),
              location: String(
                ((e.source as Record<string, unknown>)?.location) ??
                  `column '${item.feature_name}'`,
              ),
            },
          }))
        : [
            {
              claim: String(
                item.reasoning ?? "LLM detected temporal leakage risk.",
              ),
              source: {
                filename: "dataset.csv",
                location: `column '${item.feature_name}'`,
              },
            },
          ];

    const finding: AuditFinding = {
      id: `temporal-${featureName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${featureName} may use future data`,
      macro_bucket: "Time leakage",
      fine_grained_type: "temporal",
      severity,
      severity_rationale:
        severityRationaleByConf[conf] ?? severityRationaleByConf.medium,
      confidence: conf as AuditFinding["confidence"],
      flagged_object: featureName,
      evidence,
      rule_cited: RULE_CITED,
      why_it_matters:
        "Features computed with future data make the model appear accurate but fail in production.",
      fix_recommendation: [
        `Recompute ${featureName} using only data available at the prediction time point.`,
      ],
      needs_human_review: conf !== "high",
    };

    if (conf === "low") {
      finding.escalate_reason = `Confidence is low — the agent cannot determine with certainty whether ${featureName} uses future data. Human domain expertise recommended.`;
    }

    findings.push(finding);
  }

  return findings;
}
