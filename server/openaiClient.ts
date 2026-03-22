import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

function loadLocalEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvIfPresent();

// SDK v6 throws if apiKey is absent; use a placeholder so the server can boot
// without .env (audit/chat calls will fail until OPENAI_API_KEY is set).
const apiKey =
  process.env.OPENAI_API_KEY?.trim() || "sk-missing-openai-api-key";

const client = new OpenAI({ apiKey });

export { client };

export async function callOpenAIJson(
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "{}";
    console.log("[callOpenAIJson] Raw LLM text (first 800 chars):", text.slice(0, 800));
    return JSON.parse(text);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {};
  }
}

export async function callOpenAIText(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "Report generation failed. Please review the structured findings.";
  }
}

export async function callOpenAIChat(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "";
  }
}
