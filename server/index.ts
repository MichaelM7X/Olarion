import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AUDIT_SYSTEM_PROMPT = `You are LeakGuard, an expert ML auditor specializing in data leakage detection. Analyze ML pipeline descriptions and identify data integrity risks with precision.

## Leakage Taxonomy

### Macro Buckets (use these exact strings):
1. "Time leakage" — features computed from data beyond the prediction cutoff timestamp
2. "Feature / proxy leakage" — features that directly encode or closely approximate the target label
3. "Structure / pipeline leakage" — train/test split design flaws, preprocessing contamination, or repeated entity leakage

### Fine-Grained Types (use these exact strings):
- "temporal" — feature uses data not available at prediction time
- "proxy" — feature approximates the label via downstream signals or workflow artifacts
- "evaluation" — test data bleeds into training/preprocessing steps
- "boundary" — train/test boundary is explicitly violated
- "join_entity" — same entity (patient, borrower, building, user) appears in both train and test sets
- "duplicate" — near-duplicate or identical rows span the train/test split
- "aggregation_lookahead" — derived aggregate uses future rows beyond the prediction cutoff
- "label_definition" — feature is a near-restatement or reformulation of the target variable
- "missing_metadata" — key metadata required for audit verification is absent

### Severity:
- "critical" — model is certainly cheating; results are invalid
- "high" — strong evidence of leakage; deployment risk is real
- "medium" — suspicious signal worth investigating
- "low" — minor concern; unlikely to materially affect integrity

### Confidence: "high" | "medium" | "low"

## Instructions
For each feature in feature_dictionary:
1. Read its name, description, semantic_tags, and availability timing
2. Reason whether it encodes future information relative to the prediction boundary
3. Assess whether it proxies or directly encodes the prediction target
4. Check pipeline_notes for split design and preprocessing issues
5. Apply domain-appropriate reasoning based on domain_template

Be thorough but precise — do NOT flag obviously clean signals. Think like a senior ML practitioner.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation:
{
  "overall_risk": "critical" | "high" | "medium" | "low",
  "summary": "2–3 sentence overview of main risks",
  "findings": [
    {
      "id": "unique-kebab-case-id",
      "title": "Concise finding title",
      "macro_bucket": "Time leakage" | "Feature / proxy leakage" | "Structure / pipeline leakage",
      "fine_grained_type": "<one of the fine-grained type strings above>",
      "severity": "critical" | "high" | "medium" | "low",
      "confidence": "high" | "medium" | "low",
      "flagged_object": "feature name or pipeline component name",
      "evidence": ["specific evidence item 1", "specific evidence item 2"],
      "why_it_matters": "Concrete explanation of the risk impact",
      "fix_recommendation": ["actionable fix step 1", "actionable fix step 2"],
      "needs_human_review": true | false
    }
  ],
  "bucket_summary": {
    "Time leakage": <integer>,
    "Feature / proxy leakage": <integer>,
    "Structure / pipeline leakage": <integer>
  },
  "missing_metadata": ["field_name_1"],
  "clarifying_questions": ["Question 1?"],
  "fix_plan": ["Top priority fix 1", "Top priority fix 2"]
}`;

app.post("/api/audit", async (req, res) => {
  try {
    const { request } = req.body as { request: unknown };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: AUDIT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Audit this ML pipeline for data leakage risks:\n\n${JSON.stringify(request, null, 2)}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude API");
    }

    // Strip any accidental markdown code fences
    const jsonText = content.text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const report = JSON.parse(jsonText) as unknown;
    res.json({ report });
  } catch (error) {
    console.error("Audit error:", error);
    res.status(500).json({ error: String(error) });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { question, report, request, history } = req.body as {
      question: string;
      report: Record<string, unknown>;
      request: Record<string, unknown>;
      history: Array<{ role: string; content: string }>;
    };

    const findings = (report.findings as Array<Record<string, unknown>>) ?? [];

    const systemPrompt = `You are LeakGuard, an ML data leakage expert. You completed an audit of the following ML pipeline:

Dataset: ${request.dataset_ref ?? "Unknown"}
Prediction Goal: ${request.prediction_goal ?? "Not specified"}
Overall Risk: ${String(report.overall_risk ?? "unknown").toUpperCase()}
Summary: ${report.summary ?? ""}

Findings (${findings.length} total):
${findings
  .map(
    (f) =>
      `- [${String(f.severity).toUpperCase()}] ${f.title} (${f.flagged_object}): ${f.why_it_matters}`,
  )
  .join("\n")}

Answer questions about this audit concisely and precisely. Reference specific findings by name when relevant. Focus on actionable guidance. Keep responses under 200 words unless a detailed explanation is truly needed.`;

    const messages = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    messages.push({ role: "user", content: question });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude API");
    }

    res.json({ answer: content.text });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: String(error) });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(Number(PORT), () => {
  console.log(`LeakGuard API server running on http://localhost:${PORT}`);
});
