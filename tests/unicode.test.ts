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
      "\\u3053\\u3093\\u306B\\u3061\\u306F"
    );
    expect(escapeUnicode("hello こんにちは world")).toBe(
      "hello \\u3053\\u3093\\u306B\\u3061\\u306F world"
    );
  });

  it("絵文字（サロゲートペア）を正しくエスケープする", () => {
    // 😀 = U+1F600 → サロゲートペア: \uD83D\uDE00
    expect(escapeUnicode("😀")).toBe("\\uD83D\\uDE00");
    expect(escapeUnicode("hi 😀 bye")).toBe("hi \\uD83D\\uDE00 bye");
  });

  it("混合コンテンツを正しく処理する", () => {
    expect(escapeUnicode("test テスト 123")).toBe(
      "test \\u30C6\\u30B9\\u30C8 123"
    );
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

  it("escapeUnicodeの逆変換になる", () => {
    const original = "テスト test 😀 こんにちは";
    expect(unescapeUnicode(escapeUnicode(original))).toBe(original);
  });
});
