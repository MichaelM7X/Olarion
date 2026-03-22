import type { AuditReport, AuditRequest } from "../types";

export interface ThinkingStep {
  id: string;
  status: "running" | "done" | "skipped";
  title: string;
  detail?: string;
  timestamp: number;
}

export async function auditWithLLM(
  request: AuditRequest,
): Promise<AuditReport> {
  const response = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
  });

  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as { report?: AuditReport; error?: string }) : {};

  if (!response.ok) {
    throw new Error(payload.error ?? `Audit request failed: ${response.status}`);
  }

  const { report } = payload;
  if (!report) {
    throw new Error("Audit response did not include a report.");
  }

  return report;
}

export async function auditWithStream(
  request: AuditRequest,
  onStep: (step: ThinkingStep) => void,
): Promise<AuditReport> {
  const response = await fetch("/api/audit-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
  });

  if (!response.ok) {
    throw new Error(`Audit request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let report: AuditReport | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "step") {
          onStep({
            id: event.id,
            status: event.status,
            title: event.title,
            detail: event.detail,
            timestamp: Date.now(),
          });
        } else if (event.type === "complete") {
          report = event.report;
        } else if (event.type === "error") {
          throw new Error(event.message ?? "Audit failed");
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Audit failed") continue;
        throw e;
      }
    }
  }

  if (!report) throw new Error("Audit stream ended without a report.");
  return report;
}

export async function chatWithLLM(
  question: string,
  report: AuditReport,
  request: AuditRequest,
  history: Array<{ role: string; content: string }>,
): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, report, request, history }),
  });

  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as { answer?: string; error?: string }) : {};

  if (!response.ok) {
    throw new Error(payload.error ?? `Chat request failed: ${response.status}`);
  }

  const { answer } = payload;
  if (!answer) {
    throw new Error("Chat response did not include an answer.");
  }

  return answer;
}
