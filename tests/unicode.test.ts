import { describe, it, expect } from "vitest";
import { escapeUnicode, unescapeUnicode } from "../src/utils/unicode";

describe("escapeUnicode", () => {
  it("ASCII文字のみの文字列はそのまま返す", () => {
    expect(escapeUnicode("hello world")).toBe("hello world");
    expect(escapeUnicode("abc 123 !@#")).toBe("abc 123 !@#");
  });

  it("空文字列は空文字列を返す", () => {
    expect(escapeUnicode("")).toBe("");
  });

  it("日本語を含む文字列の非ASCII部分を\\uXXXX形式に変換する", () => {
    expect(escapeUnicode("こんにちは")).toBe(
      " \\u3053\\u3093\\u306B\\u3061\\u306F"
    );
    expect(escapeUnicode("hello こんにちは world")).toBe(
      "hello \\u3053\\u3093\\u306B\\u3061\\u306F world"
    );
  });

  it("絵文字（サロゲートペア）を正しくエスケープする", () => {
    // 😀 = U+1F600 → サロゲートペア: \uD83D\uDE00
    expect(escapeUnicode("😀")).toBe(" \\uD83D\\uDE00");
    expect(escapeUnicode("hi 😀 bye")).toBe("hi \\uD83D\\uDE00 bye");
  });

  it("混合コンテンツを正しく処理する", () => {
    expect(escapeUnicode("test テスト 123")).toBe(
      "test \\u30C6\\u30B9\\u30C8 123"
    );
  });

  it("should escape leading non-ASCII characters with correct \\u prefix", () => {
    // Bug report: "正面からのアングル" displays as "6B63面からのアングル"
    // This suggests the \u prefix of \u6B63 is being lost.
    // "正面" must produce \u6B63\u9762, not "6B63\u9762" or "6B639762"
    const result = escapeUnicode("正面");
    expect(result).toBe(" \\u6B63\\u9762");
  });

  it("should produce correct escape for the full reported string", () => {
    const result = escapeUnicode("正面からのアングル");
    expect(result).toBe(
      " \\u6B63\\u9762\\u304B\\u3089\\u306E\\u30A2\\u30F3\\u30B0\\u30EB"
    );
  });

  it("先頭が非ASCIIの場合、先頭にスペースを挿入する", () => {
    const result = escapeUnicode("テスト");
    expect(result).toBe(" \\u30C6\\u30B9\\u30C8");
    expect(result.startsWith(" \\u")).toBe(true);
  });

  it("先頭がASCIIの場合、スペースを挿入しない", () => {
    expect(escapeUnicode("abc")).toBe("abc");
    expect(escapeUnicode("hello テスト")).toBe("hello \\u30C6\\u30B9\\u30C8");
  });
});

describe("unescapeUnicode", () => {
  it("\\uXXXX形式を元の文字に戻す", () => {
    expect(unescapeUnicode("\\u3053\\u3093\\u306B\\u3061\\u306F")).toBe(
      "こんにちは"
    );
  });

  it("ASCII文字はそのまま残す", () => {
    expect(unescapeUnicode("hello world")).toBe("hello world");
  });

  it("空文字列は空文字列を返す", () => {
    expect(unescapeUnicode("")).toBe("");
  });

  it("混合コンテンツを正しく処理する", () => {
    expect(
      unescapeUnicode("hello \\u3053\\u3093\\u306B\\u3061\\u306F world")
    ).toBe("hello こんにちは world");
  });

  it("サロゲートペアを正しくデコードする", () => {
    expect(unescapeUnicode("\\uD83D\\uDE00")).toBe("😀");
  });

  it("先頭スペース+\\uXXXXパターンの場合、先頭スペースを除去してデコードする", () => {
    expect(unescapeUnicode(" \\u30C6\\u30B9\\u30C8")).toBe("テスト");
    expect(unescapeUnicode(" \\u6B63\\u9762")).toBe("正面");
  });

  it("先頭スペースなしの\\uXXXXも従来通りデコードする", () => {
    expect(unescapeUnicode("\\u6B63\\u9762")).toBe("正面");
  });

  it("escapeUnicodeの逆変換になる", () => {
    const original = "テスト test 😀 こんにちは";
    expect(unescapeUnicode(escapeUnicode(original))).toBe(original);
  });

  it("should unescape consecutive sequences without boundary confusion at \\u6B63\\u9762", () => {
    // Key test: The hex value "6B63" ends right before the next "\u9762".
    // A faulty regex or parser could consume characters across the boundary.
    // \u6B63 = "正", \u9762 = "面"
    const result = unescapeUnicode("\\u6B63\\u9762");
    expect(result).toBe("正面");
  });

  it("should unescape the full reported string with mixed ASCII", () => {
    const input =
      "\\u6B63\\u9762\\u304B\\u3089\\u306E\\u30A2\\u30F3\\u30B0\\u30EB";
    expect(unescapeUnicode(input)).toBe("正面からのアングル");
  });
});

describe("round-trip: escape then unescape", () => {
  it("should return original string for the reported bug case", () => {
    // Core bug verification: "正面からのアングル" must survive a round-trip.
    // If \u prefix is lost during escape, unescape would fail to decode and
    // the raw hex "6B63" would appear in the result.
    const original = "正面からのアングル";
    const escaped = escapeUnicode(original);
    const roundTripped = unescapeUnicode(escaped);
    expect(roundTripped).toBe(original);
  });

  it("should round-trip ASCII-only strings unchanged", () => {
    const original = "hello world 123";
    expect(unescapeUnicode(escapeUnicode(original))).toBe(original);
  });

  it("should round-trip strings with surrogate pairs", () => {
    const original = "テスト test 😀 こんにちは";
    expect(unescapeUnicode(escapeUnicode(original))).toBe(original);
  });
});
