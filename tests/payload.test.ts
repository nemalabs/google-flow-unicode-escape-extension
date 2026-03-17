import { describe, it, expect } from "vitest";
import { escapePayloadTextParts } from "../src/utils/payload";
import { escapeUnicode } from "../src/utils/unicode";

/**
 * escapePayloadTextParts のテスト
 *
 * API ペイロード内の requests[].structuredPrompt.parts[] の
 * text パートのみを escapeUnicode() で変換する純粋関数の検証。
 */

/** ヘルパー: 標準的なペイロード構造を生成する */
function makePayload(
  parts: Record<string, unknown>[]
): Record<string, unknown> {
  return {
    requests: [
      {
        structuredPrompt: {
          parts,
        },
      },
    ],
  };
}

describe("escapePayloadTextParts", () => {
  it("should escape non-ASCII characters in text parts containing Japanese", () => {
    const payload = makePayload([
      { text: "デジタルアート" },
    ]);
    const input = JSON.stringify(payload);
    const result = JSON.parse(escapePayloadTextParts(input));

    expect(result.requests[0].structuredPrompt.parts[0].text).toBe(
      escapeUnicode("デジタルアート")
    );
  });

  it("should not modify payload containing only reference parts", () => {
    const payload = makePayload([
      {
        reference: {
          media: { handle: "Nike", mediaId: "ce71e139-abcd-1234-5678-000000000000" },
        },
      },
    ]);
    const input = JSON.stringify(payload);
    const result = escapePayloadTextParts(input);

    expect(JSON.parse(result)).toEqual(payload);
  });

  it("should escape only text parts and leave reference parts unchanged in mixed payload", () => {
    const referencePart = {
      reference: {
        media: { handle: "Nike", mediaId: "ce71e139-abcd-1234-5678-000000000000" },
      },
    };
    const payload = makePayload([
      { text: "use " },
      referencePart,
      { text: " , デジタルアート" },
    ]);
    const input = JSON.stringify(payload);
    const result = JSON.parse(escapePayloadTextParts(input));

    // text パートはエスケープされる
    expect(result.requests[0].structuredPrompt.parts[0].text).toBe("use ");
    expect(result.requests[0].structuredPrompt.parts[2].text).toBe(
      escapeUnicode(" , デジタルアート")
    );
    // reference パートは不変
    expect(result.requests[0].structuredPrompt.parts[1]).toEqual(referencePart);
  });

  it("should return original string when payload has no structuredPrompt", () => {
    const payload = {
      requests: [
        {
          otherField: "value",
        },
      ],
    };
    const input = JSON.stringify(payload);
    const result = escapePayloadTextParts(input);

    expect(result).toBe(input);
  });

  it("should return original string when input is invalid JSON", () => {
    const invalidJson = "{ this is not valid json !!!";
    const result = escapePayloadTextParts(invalidJson);

    expect(result).toBe(invalidJson);
  });

  it("should process all requests when payload contains multiple requests", () => {
    const payload = {
      requests: [
        {
          structuredPrompt: {
            parts: [{ text: "猫" }],
          },
        },
        {
          structuredPrompt: {
            parts: [{ text: "犬" }],
          },
        },
      ],
    };
    const input = JSON.stringify(payload);
    const result = JSON.parse(escapePayloadTextParts(input));

    expect(result.requests[0].structuredPrompt.parts[0].text).toBe(
      escapeUnicode("猫")
    );
    expect(result.requests[1].structuredPrompt.parts[0].text).toBe(
      escapeUnicode("犬")
    );
  });

  it("should not modify text parts containing only ASCII characters", () => {
    const payload = makePayload([
      { text: "hello world, digital art" },
    ]);
    const input = JSON.stringify(payload);
    const result = JSON.parse(escapePayloadTextParts(input));

    expect(result.requests[0].structuredPrompt.parts[0].text).toBe(
      "hello world, digital art"
    );
  });
});
