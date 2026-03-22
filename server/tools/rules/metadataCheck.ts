import { AuditRequest, AuditFinding } from "../../../src/types";

export function metadataCheck(request: AuditRequest): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Check 1: target column missing from csv_columns
  if (request.target_column && !request.csv_columns.includes(request.target_column)) {
    findings.push({
      id: "metadata-missing-target",
      title: `Target column "${request.target_column}" not found in CSV headers`,
      macro_bucket: "Structure / pipeline leakage",
      fine_grained_type: "missing_metadata",
      severity: "critical",
      severity_rationale: "Critical: the declared target column does not appear in the dataset",
      confidence: "high",
      flagged_object: request.target_column,
      evidence: [{
        claim: `Column "${request.target_column}" is not present in the CSV header row.`,
        source: { filename: "dataset.csv", location: `headers: ${request.csv_columns.join(", ")}` },
      }],
      rule_cited: "Target variable must exist in the training dataset",
      why_it_matters: "If the target column is missing or misspelled, the entire audit is based on incorrect assumptions.",
      fix_recommendation: ["Verify the target column name matches the CSV header exactly."],
      needs_human_review: false,
    });
  }

  // Check 2: suspicious column names that look like target proxies
  const suspiciousPattern = /^(label|target|outcome|y_true|prediction|predicted|y_pred|is_positive|class_label)$/i;
  const targetLower = (request.target_column ?? "").toLowerCase();
  for (const col of request.csv_columns) {
    if (col.toLowerCase() === targetLower) continue;
    if (suspiciousPattern.test(col)) {
      findings.push({
        id: `metadata-suspicious-${col.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: `Column "${col}" has a name suggesting it may be a target derivative`,
        macro_bucket: "Feature / proxy leakage",
        fine_grained_type: "proxy",
        severity: "medium",
        severity_rationale: `Medium: column name "${col}" matches common target/label naming patterns`,
        confidence: "medium",
        flagged_object: col,
        evidence: [{
          claim: `Column "${col}" matches suspicious naming pattern (label, target, outcome, prediction, etc.).`,
          source: { filename: "dataset.csv", location: `column "${col}"` },
        }],
        rule_cited: "Columns with target-like names warrant manual verification to rule out proxy leakage",
        why_it_matters: "A column named like a label or prediction may be a direct copy or derivative of the target.",
        fix_recommendation: [`Verify that "${col}" is a legitimate feature and not derived from the target variable.`],
        needs_human_review: true,
      });
    }
  }

  // Check 3: no entity ID columns detected
  const hasIdCols = request.csv_columns.some(
    (col) => col.toLowerCase().endsWith("_id") || col.toLowerCase().endsWith("_key") || col.toLowerCase() === "id",
  );
  if (!hasIdCols) {
    findings.push({
      id: "metadata-no-entity-ids",
      title: "No entity ID columns detected — entity boundaries cannot be verified",
      macro_bucket: "Structure / pipeline leakage",
      fine_grained_type: "missing_metadata",
      severity: "low",
      severity_rationale: "Low: informational — entity grouping may not be applicable",
      confidence: "medium",
      flagged_object: "entity ID columns",
      evidence: [{
        claim: "No columns ending in _id or _key were found in the CSV headers.",
        source: { filename: "dataset.csv", location: `headers: ${request.csv_columns.slice(0, 10).join(", ")}${request.csv_columns.length > 10 ? "..." : ""}` },
      }],
      rule_cited: "Entity-level grouping requires identifiable entity keys in the dataset",
      why_it_matters: "Without entity IDs, the audit cannot verify whether train/test split respects entity boundaries.",
      fix_recommendation: ["If this dataset has repeated entities (e.g. patients, users), ensure an ID column is included."],
      needs_human_review: false,
    });
  }

  return findings;
}
