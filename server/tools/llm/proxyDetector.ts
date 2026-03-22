import { AuditRequest, AuditFinding, EvidenceItem } from "../../../src/types";
import { callOpenAIJson } from "../../openaiClient";
import { validateFeatureNames } from "../../utils";

const RULE_CITED =
  "Features causally downstream of the target constitute proxy leakage (Kaufman et al. 2012)";

function isMalformedAnalysisResult(result: Record<string, unknown>): boolean {
  if (!result || typeof result !== "object" || Array.isArray(result)) return true;
  if (Object.keys(result).length === 0) return true;
  if (!("analysis" in result)) return true;
  if (!Array.isArray(result.analysis)) return true;
  return false;
}

function diagnosticProxyFinding(): AuditFinding {
  return {
    id: "diagnostic-proxy-detector",
    title: "Proxy detection could not complete — manual review needed",
    macro_bucket: "Feature / proxy leakage",
    fine_grained_type: "proxy",
    severity: "medium",
    severity_rationale:
      "Unable to assess — LLM analysis returned no results",
    confidence: "low",
    flagged_object: "proxy detection tool",
    evidence: [
      {
        claim: "OpenAI API returned empty or malformed response.",
        source: { filename: "system", location: "proxyDetector" },
      },
    ],
    rule_cited: RULE_CITED,
    escalate_reason:
      "Automated proxy analysis could not complete. A human reviewer should manually inspect features for target proxies.",
    why_it_matters:
      "Proxy leakage check was inconclusive — issues may exist but were not detected.",
    fix_recommendation: [
      "Manually review each feature for causal relationship to the target variable.",
    ],
    needs_human_review: true,
  };
}

export async function detectProxyLeakage(
  request: AuditRequest,
): Promise<AuditFinding[]> {
  const featureColumns = request.csv_columns.filter(
    (c) => c !== request.target_column,
  );
  const featureList = featureColumns.map((f) => `- ${f}`).join("\n");

  const systemPrompt = `You are an expert ML auditor specializing in data leakage detection.
Analyze each feature column and determine if it is a target proxy — meaning it is causally 
downstream of the label, or is essentially a restatement of the label.

Based on the prediction task description, infer when the prediction happens, then analyze
whether each feature would realistically be available at that time.

You must respond with ONLY valid JSON.`;

  const userPrompt = `Prediction task: ${request.prediction_goal}
Target column: ${request.target_column}

Feature columns to analyze:
${featureList}

Preprocessing code context:
${request.preprocessing_code}

For each feature, determine:
1. Is this feature causally upstream (a legitimate predictor) or downstream (a result/proxy) of the target?
2. Based on the prediction task, would this feature realistically be available at prediction time?

Respond in this exact JSON format:
{
  "analysis": [
    {
      "feature_name": "...",
      "is_proxy": true or false,
      "reasoning": "one sentence explanation",
      "confidence": "high" or "medium" or "low",
      "evidence": [
        {
          "claim": "one concrete factual observation",
          "source": {
            "filename": "dataset.csv",
            "location": "column name or row range (e.g. column 'feature_name', rows 1-N)"
          }
        }
      ]
    }
  ]
}`;

  const result = await callOpenAIJson(systemPrompt, userPrompt);
  if (isMalformedAnalysisResult(result)) {
    return [diagnosticProxyFinding()];
  }

  const analysis = result.analysis as Array<Record<string, unknown>>;
  const flaggedItems = analysis.filter((item) => item.is_proxy === true);
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
    const severityMap: Record<string, string> = {
      high: "critical",
      medium: "high",
      low: "medium",
    };
    const severity = (severityMap[conf] ?? "medium") as AuditFinding["severity"];

    const severityRationaleByConf: Record<string, string> = {
      high:
        "High-confidence assessment that this feature is causally downstream of or restates the target.",
      medium:
        "Moderate confidence that this feature may act as a target proxy.",
      low:
        "Low-confidence signal; proxy relationship is uncertain and requires human verification.",
    };

    const rawEvidence = (item.evidence as Array<Record<string, unknown>>) ?? [];
    const evidence: EvidenceItem[] =
      rawEvidence.length > 0
        ? rawEvidence.map((e) => ({
            claim: String(
              (e.claim as string) ??
                item.reasoning ??
                "Proxy leakage risk detected",
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
                item.reasoning ?? "LLM detected proxy leakage risk.",
              ),
              source: {
                filename: "dataset.csv",
                location: `column '${item.feature_name}'`,
              },
            },
          ];

    const finding: AuditFinding = {
      id: `proxy-${featureName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${featureName} appears to be a proxy for the target`,
      macro_bucket: "Feature / proxy leakage",
      fine_grained_type: "proxy",
      severity,
      severity_rationale:
        severityRationaleByConf[conf] ?? severityRationaleByConf.medium,
      confidence: conf as AuditFinding["confidence"],
      flagged_object: featureName,
      evidence,
      rule_cited: RULE_CITED,
      why_it_matters:
        "The model may be reading the answer key instead of learning predictive patterns.",
      fix_recommendation: [
        `Remove ${featureName} from the feature set, or redefine the prediction boundary.`,
      ],
      needs_human_review: conf !== "high",
    };

    if (conf === "low") {
      finding.escalate_reason = `Confidence is low — the agent cannot determine with certainty whether ${featureName} is a target proxy. Human domain expertise recommended.`;
    }

    findings.push(finding);
  }

  return findings;
}
