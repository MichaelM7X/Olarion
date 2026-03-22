import cors from "cors";
import express from "express";
import { runAudit } from "./orchestrator";
import { answerQuestion } from "./tools/llm/chatAgent";
import { callOpenAIJson } from "./openaiClient";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.post("/api/audit", async (req, res) => {
  try {
    const { request } = req.body;
    const report = await runAudit(request);
    res.json({ report });
  } catch (error) {
    console.error("Audit error:", error);
    res.status(500).json({ error: "Audit failed" });
  }
});

app.post("/api/audit-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const { request } = req.body;

  const sendEvent = (type: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const report = await runAudit(request, (event) => {
      sendEvent("step", event as unknown as Record<string, unknown>);
    });
    sendEvent("complete", { report: report as unknown as Record<string, unknown> });
  } catch (error) {
    console.error("Audit stream error:", error);
    sendEvent("error", { message: "Audit failed" });
  }

  res.end();
});

app.post("/api/chat", async (req, res) => {
  try {
    const { question, report, request, history } = req.body;
    const answer = await answerQuestion(
      question,
      report,
      request,
      history ?? [],
    );
    res.json({ answer });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat failed" });
  }
});

app.post("/api/classify-code", async (req, res) => {
  try {
    const { files } = req.body as {
      files: Array<{ filename: string; content: string }>;
    };

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    if (files.length === 1) {
      res.json({
        preprocessing_code: files[0].content,
        model_training_code: null,
      });
      return;
    }

    const fileSummaries = files
      .map(
        (f, i) =>
          `--- File ${i + 1}: "${f.filename}" ---\n${f.content.slice(0, 3000)}`,
      )
      .join("\n\n");

    const result = await callOpenAIJson(
      `You classify Python files for an ML audit tool. Given multiple Python files, determine which one is the data preprocessing / feature engineering code and which one is the model training / evaluation code.

Return JSON: { "preprocessing_index": <0-based index>, "training_index": <0-based index or null> }

Rules:
- The preprocessing file typically contains: pd.read_csv, feature transforms, train_test_split, StandardScaler, encoding, etc.
- The training file typically contains: model.fit, classifier/regressor instantiation, accuracy_score, cross_val_score, etc.
- If both concerns are in a single file, set that as preprocessing_index and training_index to null.
- If you can't tell, default the first file to preprocessing and the second to training.`,
      `Classify these ${files.length} Python files:\n\n${fileSummaries}`,
    );

    const preIdx = Number(result.preprocessing_index ?? 0);
    const trainIdx =
      result.training_index != null ? Number(result.training_index) : null;

    res.json({
      preprocessing_code: files[preIdx]?.content ?? files[0].content,
      model_training_code:
        trainIdx != null ? (files[trainIdx]?.content ?? null) : null,
    });
  } catch (error) {
    console.error("Classify error:", error);
    res.status(500).json({ error: "Classification failed" });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(Number(PORT), () => {
  console.log(`Olarion API running on http://localhost:${PORT}`);
});
