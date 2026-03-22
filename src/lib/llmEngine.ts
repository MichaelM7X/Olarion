import type { AuditReport, AuditRequest } from "../types";

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
