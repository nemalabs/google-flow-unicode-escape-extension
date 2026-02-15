import { describe, it, expect, beforeEach } from "vitest";
import { setupUnicodeEscape } from "../src/content";

describe("Content Script", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function createTextArea(value: string): HTMLTextAreaElement {
    const textarea = document.createElement("textarea");
    textarea.id = "PINHOLE_TEXT_AREA_ELEMENT_ID";
    textarea.value = value;
    return textarea;
  }

  function createSubmitButton(): HTMLButtonElement {
    const button = document.createElement("button");
    const span = document.createElement("span");
    span.textContent = "作成";
    button.appendChild(span);
    return button;
  }

  function createReuseButton(): HTMLButtonElement {
    const button = document.createElement("button");
    const span = document.createElement("span");
    span.textContent = "プロンプトを再利用";
    button.appendChild(span);
    return button;
  }

  describe("setupUnicodeEscape", () => {
    it("Enterキー押下でテキストが変換される", () => {
      const textarea = createTextArea("入力テスト");
      document.body.appendChild(textarea);
      setupUnicodeEscape();

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(textarea.value).toBe(" \\u5165\\u529B\\u30C6\\u30B9\\u30C8");
    });

    it("inputイベント中にアプリがvalueを再設定してもエスケープ値が保持される", () => {
      const textarea = createTextArea("正面からのアングル");
      document.body.appendChild(textarea);
      setupUnicodeEscape();

      // アプリのinputハンドラがvalueを再設定するシミュレート
      textarea.addEventListener("input", () => {
        // React等のフレームワークがcontrolled componentで値を再設定するケース
        const current = textarea.value;
        textarea.value = current;
      });

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // エスケープ値が維持されていること（デコードされていないこと）
      expect(textarea.value).toBe(
        " \\u6B63\\u9762\\u304B\\u3089\\u306E\\u30A2\\u30F3\\u30B0\\u30EB"
      );
    });

    it("IME変換確定のEnterキーではテキストが変換されない", () => {
      const textarea = createTextArea("入力テスト");
      document.body.appendChild(textarea);
      setupUnicodeEscape();

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          isComposing: true,
        })
      );

      expect(textarea.value).toBe("入力テスト");
    });

    it("Shift+Enterではテキストが変換されない（改行目的）", () => {
      const textarea = createTextArea("入力テスト");
      document.body.appendChild(textarea);
      setupUnicodeEscape();

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          shiftKey: true,
        })
      );

      expect(textarea.value).toBe("入力テスト");
    });

    it("「作成」ボタンclickでテキストが変換される", () => {
      const textarea = createTextArea("日本語");
      const button = createSubmitButton();
      document.body.appendChild(textarea);
      document.body.appendChild(button);
      setupUnicodeEscape();

      button.click();

      expect(textarea.value).toBe(" \\u65E5\\u672C\\u8A9E");
    });

    it("ASCII文字のみの場合は変換されない", () => {
      const textarea = createTextArea("hello world");
      document.body.appendChild(textarea);
      setupUnicodeEscape();

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(textarea.value).toBe("hello world");
    });

    it("要素が後から追加された場合MutationObserverで検知する", async () => {
      setupUnicodeEscape();

      const textarea = createTextArea("遅延追加");
      document.body.appendChild(textarea);

      await new Promise((resolve) => setTimeout(resolve, 0));

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(textarea.value).toBe(" \\u9045\\u5EF6\\u8FFD\\u52A0");
    });

    it("表示エリアの\\uXXXXテキストが自動デコードされる", async () => {
      setupUnicodeEscape();

      const div = document.createElement("div");
      div.textContent = "\\u30C6\\u30B9\\u30C8";
      document.body.appendChild(div);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("テスト");
    });

    it("表示エリアのASCIIテキストはデコードされない", async () => {
      setupUnicodeEscape();

      const div = document.createElement("div");
      div.textContent = "hello world";
      document.body.appendChild(div);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("hello world");
    });

    it("初回アクセス時に既存DOMの\\uXXXXテキストがデコードされる", async () => {
      // setupの前に既存DOM要素を配置
      const div = document.createElement("div");
      div.textContent = "\\u30C6\\u30B9\\u30C8";
      document.body.appendChild(div);

      setupUnicodeEscape();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("テスト");
    });

    it("「プロンプトを再利用」ボタンclickでtextareaがデコードされる", async () => {
      const textarea = createTextArea("");
      const reuseBtn = createReuseButton();
      document.body.appendChild(textarea);
      document.body.appendChild(reuseBtn);
      setupUnicodeEscape();

      // ボタンクリック後にSPAが値を設定するシミュレート
      reuseBtn.click();
      textarea.value = "\\u30C6\\u30B9\\u30C8 reuse";

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(textarea.value).toBe("テスト reuse");
    });

    it("表示エリアの「正面からのアングル」エスケープが正しくデコードされる", async () => {
      setupUnicodeEscape();

      const div = document.createElement("div");
      div.textContent =
        " \\u6B63\\u9762\\u304B\\u3089\\u306E\\u30A2\\u30F3\\u30B0\\u30EB";
      document.body.appendChild(div);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("正面からのアングル");
    });

    it("textareaに「正面からのアングル」のエスケープ値が設定された時にデコードされる", async () => {
      const textarea = createTextArea("");
      document.body.appendChild(textarea);
      setupUnicodeEscape();

      await new Promise((resolve) => setTimeout(resolve, 0));

      textarea.value =
        " \\u6B63\\u9762\\u304B\\u3089\\u306E\\u30A2\\u30F3\\u30B0\\u30EB";

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(textarea.value).toBe("正面からのアングル");
    });

    it("textareaにプログラム的に値が設定された時にデコードされる", async () => {
      const textarea = createTextArea("");
      document.body.appendChild(textarea);
      setupUnicodeEscape();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // 履歴からロードをシミュレート（プログラム的にvalueを設定）
      textarea.value = "\\u30C6\\u30B9\\u30C8 test";

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(textarea.value).toBe("テスト test");
    });
  });
});
