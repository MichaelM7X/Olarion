import OpenAI from "openai";

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
