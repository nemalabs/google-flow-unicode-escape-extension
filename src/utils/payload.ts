import { escapeUnicode } from "./unicode";

export function escapePayloadTextParts(body: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }

  if (!Array.isArray(parsed.requests)) {
    return body;
  }

  for (const request of parsed.requests) {
    const parts = (request as Record<string, unknown>).structuredPrompt
      ? ((request as Record<string, unknown>).structuredPrompt as Record<string, unknown>).parts
      : undefined;
    if (!Array.isArray(parts)) {
      continue;
    }
    for (const part of parts) {
      if (typeof (part as Record<string, unknown>).text === "string") {
        (part as Record<string, unknown>).text = escapeUnicode(
          (part as Record<string, unknown>).text as string
        );
      }
    }
  }

  return JSON.stringify(parsed);
}
