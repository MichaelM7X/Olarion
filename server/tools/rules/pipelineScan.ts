import { AuditRequest, AuditFinding, EvidenceItem } from "../../../src/types";
import { findLineNumber, resolveLineLocation } from "../../utils";

const PREPROCESSING_FILE = "preprocessing_code.py";

/** First index of an actual split-style call (avoids matching class names on import-only lines). */
function splitIndices(code: string): number[] {
  const patterns: RegExp[] = [
    /\btrain_test_split\s*\(/,
    /\bgroupkfold\s*\(/i,
    /\bgroupshufflesplit\s*\(/i,
    /\btimeseriessplit\s*\(/i,
    /\bstratifiedkfold\s*\(/i,
    /\bkfold\s*\(/i,
    /\.split\s*\(/,
  ];
  const out: number[] = [];
  for (const re of patterns) {
    const m = code.match(re);
    if (m?.index != null) out.push(m.index);
  }
  return out;
}

function firstSplitIndex(code: string): number {
  const indices = splitIndices(code);
  return indices.length ? Math.min(...indices) : -1;
}

function hasSplitMarker(code: string): boolean {
  return firstSplitIndex(code) >= 0;
}

/** Substring/keyword for resolveLineLocation pointing at the main split in the script. */
function primarySplitEvidenceKeyword(code: string): string {
  if (code.includes("train_test_split")) return "train_test_split";
  if (code.includes("stratifiedkfold")) return "StratifiedKFold";
  if (code.includes("groupkfold")) return "GroupKFold";
  if (code.includes("groupshufflesplit")) return "GroupShuffleSplit";
  if (code.includes("timeseriessplit")) return "TimeSeriesSplit";
  if (code.includes("kfold")) return "KFold";
  return ".split(";
}

/** Keyword for resolveLineLocation: first target-encoding pattern before split, or null. */
function findTargetEncodingKeyword(
  rawCode: string,
  code: string,
  splitIdx: number,
  targetCol?: string,
): string | null {
  if (splitIdx < 0) return null;
  const headRaw = rawCode.slice(0, splitIdx);
  const lines = headRaw.split("\n");
  const tc = (targetCol ?? "").toLowerCase().trim();
  for (const line of lines) {
    const low = line.toLowerCase();
    if (low.includes("labelencoder") && (/\by\b/.test(low) || (!!tc && low.includes(tc)))) {
      return "LabelEncoder";
    }
    if (low.includes("ordinalencoder") && (/\by\b/.test(low) || (!!tc && low.includes(tc)))) {
      return "OrdinalEncoder";
    }
    if (tc && low.includes("get_dummies") && low.includes(tc)) {
      return "get_dummies";
    }
  }
  return null;
}

function hasLeakyFillnaBeforeSplit(code: string, splitIdx: number): boolean {
  if (splitIdx < 0) return false;
  const head = code.slice(0, splitIdx);
  return /\.fillna\s*\([^)]*\.(mean|median)\s*\(/.test(head);
}

/** Prefer a distinctive snippet from the leaky fillna line for line resolution. */
function fillnaLeakLocationKeyword(rawCode: string, splitIdx: number): string {
  if (splitIdx < 0) return ".fillna(";
  const head = rawCode.slice(0, splitIdx);
  const m = head.match(/\.fillna\s*\([^)]*\.(mean|median)\s*\(/i);
  if (m && m.index != null) {
    const lineStart = head.lastIndexOf("\n", m.index) + 1;
    const lineEnd = head.indexOf("\n", m.index);
    const line = head.slice(lineStart, lineEnd === -1 ? head.length : lineEnd).trim();
    if (line) return line.length > 120 ? line.slice(0, 120) : line;
  }
  const fillLineIdx = findLineNumber(head, ".fillna(");
  if (fillLineIdx != null) {
    const line = head.split("\n")[fillLineIdx - 1]?.trim() ?? "";
    if (line && /\.fillna\s*\([^)]*\.(mean|median)\s*\(/i.test(line)) {
      return line.length > 120 ? line.slice(0, 120) : line;
    }
  }
  return ".fillna(";
}

function hasLookAheadGroupbyTransformMean(code: string, splitIdx: number): boolean {
  if (splitIdx < 0) return false;
  const head = code.slice(0, splitIdx);
  return /groupby\s*\([^)]*\)[\s\S]*?\.transform\s*\(\s*['"]mean['"]\s*\)/.test(head);
}

/** Single-line snippet at the groupby transform site for resolveLineLocation / findLineNumber. */
function groupbyTransformMeanLocationKeyword(rawCode: string, splitIdx: number): string {
  if (splitIdx < 0) return "groupby";
  const head = rawCode.slice(0, splitIdx);
  const m = head.match(
    /groupby\s*\([^)]*\)[\s\S]*?\.transform\s*\(\s*['"]mean['"]\s*\)/i,
  );
  if (m && m.index != null) {
    const lineStart = head.lastIndexOf("\n", m.index) + 1;
    const lineEnd = head.indexOf("\n", m.index);
    const line = head.slice(lineStart, lineEnd === -1 ? head.length : lineEnd).trim();
    if (line) return line.length > 120 ? line.slice(0, 120) : line;
  }
  return "groupby";
}

function hasDropDuplicatesAfterSplit(code: string): boolean {
  const m = code.match(/\btrain_test_split\s*\(/);
  const splitAt = m?.index ?? -1;
  const dupAt = code.indexOf("drop_duplicates");
  return splitAt >= 0 && dupAt >= 0 && splitAt < dupAt;
}

export function pipelineScan(request: AuditRequest): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const rawCode = request.preprocessing_code ?? "";
  const code = rawCode.toLowerCase();

  if (!code) return findings;

  const splitIdx = firstSplitIndex(code);

  const hasRandomSplit =
    /\btrain_test_split\s*\(/.test(code) &&
    !/\bgroupkfold\s*\(/i.test(code) &&
    !/\bgroupshufflesplit\s*\(/i.test(code) &&
    !/\btimeseriessplit\s*\(/i.test(code);

  const hasIdColumns = request.csv_columns.some(
    (col) =>
      col.toLowerCase().endsWith("_id") ||
      col.toLowerCase().endsWith("_key") ||
      col.toLowerCase() === "id",
  );

  if (hasRandomSplit && hasIdColumns) {
    const idCols = request.csv_columns.filter(
      (col) =>
        col.toLowerCase().endsWith("_id") ||
        col.toLowerCase().endsWith("_key") ||
        col.toLowerCase() === "id",
    );
    const entityEvidence: EvidenceItem[] = [
      {
        claim: "Preprocessing code uses train_test_split without group-based splitting.",
        source: {
          filename: PREPROCESSING_FILE,
          location: resolveLineLocation(rawCode, PREPROCESSING_FILE, "train_test_split"),
        },
      },
      {
        claim: `Likely entity ID columns detected: ${idCols.join(", ")}.`,
        source: {
          filename: "dataset.csv",
          location: `columns: ${idCols.join(", ")}`,
        },
      },
    ];
    findings.push({
      id: "pipeline-random-split-entity",
      rule_cited: "RL-PIPELINE-RANDOM-SPLIT-ENTITY",
      title: "Random split may leak repeated entities",
      macro_bucket: "Structure / pipeline leakage",
      fine_grained_type: "join_entity",
      severity: "high",
      severity_rationale:
        "Repeated entities in train and test let the model memorize identities, inflating offline metrics.",
      confidence: "medium",
      flagged_object: idCols.join(", "),
      evidence: entityEvidence,
      why_it_matters:
        "Model may memorize entity identity instead of learning the task.",
      fix_recommendation: ["Use GroupKFold split keyed by entity ID."],
      needs_human_review: false,
    });
  }

  const globalPatterns = [
    { pattern: "fit(", label: "fit() called (possible global preprocessing)" },
    {
      pattern: "fit_transform(",
      label: "fit_transform() called (possible global preprocessing)",
    },
  ];

  const hasSplit = hasSplitMarker(code);

  for (const { pattern, label } of globalPatterns) {
    const fitIndex = code.indexOf(pattern);
    const splitIndex = firstSplitIndex(code);

    if (fitIndex >= 0 && hasSplit && splitIndex >= 0 && fitIndex < splitIndex) {
      const globalEvidence: EvidenceItem[] = [
        {
          claim: `Code contains ${label} before the train/test split.`,
          source: {
            filename: PREPROCESSING_FILE,
            location: resolveLineLocation(rawCode, PREPROCESSING_FILE, pattern),
          },
        },
        {
          claim: "Preprocessing fitted before split leaks test distribution into training.",
          source: {
            filename: PREPROCESSING_FILE,
            location: resolveLineLocation(
              rawCode,
              PREPROCESSING_FILE,
              primarySplitEvidenceKeyword(code),
            ),
          },
        },
      ];
      findings.push({
        id: "pipeline-global-preprocessing",
        rule_cited: "RL-PIPELINE-GLOBAL-PREPROCESSING",
        title: "Global preprocessing may mix future information",
        macro_bucket: "Structure / pipeline leakage",
        fine_grained_type: "evaluation",
        severity: "medium",
        severity_rationale:
          "Fitting on all rows before a split passes statistics from the holdout set into training features.",
        confidence: "medium",
        flagged_object: "pipeline preprocessing",
        evidence: globalEvidence,
        why_it_matters:
          "Even clean features become tainted if preprocessing sees test data.",
        fix_recommendation: ["Fit preprocessing inside each training fold only."],
        needs_human_review: false,
      });
      break;
    }
  }

  const targetEncKw = findTargetEncodingKeyword(
    rawCode,
    code,
    splitIdx,
    request.target_column,
  );
  if (targetEncKw && hasSplit) {
    const loc = resolveLineLocation(rawCode, PREPROCESSING_FILE, targetEncKw);
    const targetEvidence: EvidenceItem[] = [
      {
        claim: `${targetEncKw} appears to be applied to the target (or column named like the target) before the train/test split.`,
        source: { filename: PREPROCESSING_FILE, location: loc },
      },
      {
        claim: "Target-side encoding should be fit using training labels only so the holdout label distribution does not influence encoding.",
        source: {
          filename: PREPROCESSING_FILE,
          location: resolveLineLocation(
            rawCode,
            PREPROCESSING_FILE,
            primarySplitEvidenceKeyword(code),
          ),
        },
      },
    ];
    findings.push({
      id: "pipeline-target-encode-before-split",
      rule_cited: "RL-PIPELINE-TARGET-ENCODE-BEFORE-SPLIT",
      title: "Target encoding may use the full label distribution before split",
      macro_bucket: "Structure / pipeline leakage",
      fine_grained_type: "label_definition",
      severity: "high",
      severity_rationale:
        "Encoding the target on all data lets validation rows influence how labels are mapped or expanded.",
      confidence: "medium",
      flagged_object: request.target_column ?? "target (y)",
      evidence: targetEvidence,
      why_it_matters:
        "Holdout labels can indirectly shape how the model sees supervision, skewing evaluation.",
      fix_recommendation: [
        "Fit LabelEncoder/OrdinalEncoder (or target-related get_dummies) on training split only, then transform validation/test.",
      ],
      needs_human_review: false,
    });
  }

  if (hasSplit && hasLeakyFillnaBeforeSplit(code, splitIdx)) {
    const fillKw = fillnaLeakLocationKeyword(rawCode, splitIdx);
    const fillEvidence: EvidenceItem[] = [
      {
        claim:
          "fillna() is called with mean/median computed from the dataframe before the split, so holdout rows contribute to imputation statistics.",
        source: {
          filename: PREPROCESSING_FILE,
          location: resolveLineLocation(rawCode, PREPROCESSING_FILE, fillKw),
        },
      },
    ];
    findings.push({
      id: "pipeline-leaky-fillna",
      rule_cited: "RL-PIPELINE-LEAKY-FILLNA",
      title: "Imputation may use full-data mean or median before split",
      macro_bucket: "Structure / pipeline leakage",
      fine_grained_type: "evaluation",
      severity: "high",
      severity_rationale:
        "Test-row values change train-side imputation, which is a direct distribution leak across the split boundary.",
      confidence: "medium",
      flagged_object: "fillna(mean|median)",
      evidence: fillEvidence,
      why_it_matters:
        "Missing-value handling becomes optimistic because the model sees information derived from validation rows.",
      fix_recommendation: [
        "Compute mean/median (or fit SimpleImputer) on the training split only, then apply to validation/test.",
      ],
      needs_human_review: false,
    });
  }

  if (hasSplit && hasLookAheadGroupbyTransformMean(code, splitIdx)) {
    const gLocKw = groupbyTransformMeanLocationKeyword(rawCode, splitIdx);
    const aggEvidence: EvidenceItem[] = [
      {
        claim:
          "groupby().transform('mean') runs on the full dataframe before the split, so group means include future/holdout rows.",
        source: {
          filename: PREPROCESSING_FILE,
          location: resolveLineLocation(rawCode, PREPROCESSING_FILE, gLocKw),
        },
      },
    ];
    findings.push({
      id: "pipeline-lookahead-groupby-mean",
      rule_cited: "RL-PIPELINE-LOOKAHEAD-GROUPBY-MEAN",
      title: "Look-ahead aggregation via groupby transform(mean)",
      macro_bucket: "Structure / pipeline leakage",
      fine_grained_type: "aggregation_lookahead",
      severity: "high",
      severity_rationale:
        "Group-level statistics that include test rows are classic target leakage for grouped problems.",
      confidence: "medium",
      flagged_object: "groupby.transform('mean')",
      evidence: aggEvidence,
      why_it_matters:
        "Features absorb label-like signal from the same groups that appear in validation, collapsing generalization error.",
      fix_recommendation: [
        "Compute group means inside cross-validation: for each train fold, transform train and apply the same mapping to validation using only train statistics.",
      ],
      needs_human_review: false,
    });
  }

  if (hasDropDuplicatesAfterSplit(code)) {
    const dupEvidence: EvidenceItem[] = [
      {
        claim:
          "drop_duplicates appears after train_test_split, so duplicate rows may still span train and test with different handling per subset.",
        source: {
          filename: PREPROCESSING_FILE,
          location: resolveLineLocation(rawCode, PREPROCESSING_FILE, "drop_duplicates"),
        },
      },
      {
        claim: "train_test_split is applied before duplicate removal.",
        source: {
          filename: PREPROCESSING_FILE,
          location: resolveLineLocation(rawCode, PREPROCESSING_FILE, "train_test_split"),
        },
      },
    ];
    findings.push({
      id: "pipeline-drop-duplicates-after-split",
      rule_cited: "RL-PIPELINE-DROP-DUPLICATES-AFTER-SPLIT",
      title: "Duplicate removal after split may leave cross-split duplicates",
      macro_bucket: "Structure / pipeline leakage",
      fine_grained_type: "duplicate",
      severity: "medium",
      severity_rationale:
        "Order-of-operations bugs often leave related or identical rows in both partitions, weakening the validity of the split.",
      confidence: "medium",
      flagged_object: "drop_duplicates",
      evidence: dupEvidence,
      why_it_matters:
        "The model can see near-copies of validation examples in training, overstating performance.",
      fix_recommendation: [
        "Drop duplicates (and define the dedupe key) before splitting, or dedupe by entity ID before any random split.",
      ],
      needs_human_review: false,
    });
  }

  return findings;
}
