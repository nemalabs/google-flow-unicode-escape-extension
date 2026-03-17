import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupUnicodeEscape } from "../src/content";

describe("Content Script", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function createSlateEditor(text: string): HTMLDivElement {
    const editor = document.createElement("div");
    editor.setAttribute("data-slate-editor", "true");
    editor.setAttribute("contenteditable", "true");
    const p = document.createElement("p");
    p.setAttribute("data-slate-node", "element");
    const span = document.createElement("span");
    span.setAttribute("data-slate-node", "text");
    const leaf = document.createElement("span");
    leaf.setAttribute("data-slate-leaf", "true");
    leaf.textContent = text;
    span.appendChild(leaf);
    p.appendChild(span);
    editor.appendChild(p);
    return editor;
  }

  function createAttachButton(): HTMLButtonElement {
    const button = document.createElement("button");
    const icon = document.createElement("i");
    icon.textContent = "add_2";
    button.appendChild(icon);
    const textSpan = document.createElement("span");
    textSpan.textContent = "作成";
    button.appendChild(textSpan);
    return button;
  }

  function createSubmitButton(): HTMLButtonElement {
    const button = document.createElement("button");
    const icon = document.createElement("i");
    icon.textContent = "arrow_forward";
    button.appendChild(icon);
    const textSpan = document.createElement("span");
    textSpan.textContent = "作成";
    button.appendChild(textSpan);
    return button;
  }

  function createReuseButton(): HTMLButtonElement {
    const button = document.createElement("button");
    const span = document.createElement("span");
    span.textContent = "プロンプトを再利用";
    button.appendChild(span);
    return button;
  }

  // jsdomにDataTransferがないためpolyfill
  if (typeof globalThis.DataTransfer === "undefined") {
    (globalThis as Record<string, unknown>).DataTransfer = class DataTransfer {
      private data: Record<string, string> = {};
      setData(format: string, value: string) { this.data[format] = value; }
      getData(format: string) { return this.data[format] || ""; }
    };
  }

  // jsdomのInputEventがinputType/dataTransferをサポートしないためpolyfill
  const OriginalInputEvent = globalThis.InputEvent;
  if (typeof OriginalInputEvent === "function") {
    (globalThis as Record<string, unknown>).InputEvent = class PatchedInputEvent extends OriginalInputEvent {
      declare inputType: string;
      declare dataTransfer: DataTransfer | null;
      constructor(type: string, init?: InputEventInit & { inputType?: string; dataTransfer?: DataTransfer }) {
        super(type, init);
        if (init?.inputType) {
          Object.defineProperty(this, "inputType", { value: init.inputType, writable: false });
        }
        if (init?.dataTransfer) {
          Object.defineProperty(this, "dataTransfer", { value: init.dataTransfer, writable: false });
        }
      }
    };
  }

  // setEditorTextで使われるAPIのモック
  function mockEditorAPIs(): void {
    document.execCommand = vi.fn(() => true);

    // Selection API モック
    const mockRange = { selectNodeContents: vi.fn() };
    const mockSelection = {
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      toString: vi.fn(() => ""),
      rangeCount: 0,
    };
    document.createRange = vi.fn(() => mockRange as unknown as Range);
    window.getSelection = vi.fn(() => mockSelection as unknown as Selection);

    // Slateの挙動をシミュレート:
    // content.tsの setEditorText は editor.dispatchEvent(beforeinput) を呼ぶ。
    // jsdomのInputEventはinputType/dataTransferを正しくサポートしないため、
    // dispatchEventをスパイしてDOM変更を行う。
    const originalDispatch = HTMLElement.prototype.dispatchEvent;
    HTMLElement.prototype.dispatchEvent = function(event: Event) {
      // beforeinput(insertFromPaste)をインターセプト
      if (event.type === "beforeinput" && (event as InputEvent).inputType === "insertFromPaste") {
        const editor = this.closest?.('[data-slate-editor="true"]') || this;
        const dt = (event as InputEvent).dataTransfer;
        const text = dt?.getData?.("text/plain") || "";
        if (text) {
          editor.querySelectorAll('[data-slate-node="element"]').forEach((p: Element) => p.remove());
          editor.querySelector('[data-slate-placeholder="true"]')?.remove();
          for (const line of text.split("\n")) {
            const p = document.createElement("p");
            p.setAttribute("data-slate-node", "element");
            const span = document.createElement("span");
            span.setAttribute("data-slate-node", "text");
            const leaf = document.createElement("span");
            leaf.setAttribute("data-slate-leaf", "true");
            leaf.textContent = line;
            span.appendChild(leaf);
            p.appendChild(span);
            editor.appendChild(p);
          }
          return false; // preventDefault simulated
        }
      }
      return originalDispatch.call(this, event);
    };
  }

  describe("setupUnicodeEscape", () => {
    it("Enterキー押下でSlateエディタのテキストが変換されない（fetch側で処理）", () => {
      const editor = createSlateEditor("入力テスト");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(leaf.textContent).toBe("入力テスト");
    });

    it("IME変換確定のEnterキーではテキストが変換されない（isComposing）", () => {
      const editor = createSlateEditor("入力テスト");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          isComposing: true,
        })
      );

      expect(leaf.textContent).toBe("入力テスト");
    });

    it("compositionend直後のEnterキーはブロックされる", async () => {
      const editor = createSlateEditor("入力テスト");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;

      // compositionend発火
      leaf.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));

      // 直後のEnter（同じイベントループ内）
      const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      leaf.dispatchEvent(enterEvent);

      expect(enterEvent.defaultPrevented).toBe(true);
      expect(leaf.textContent).toBe("入力テスト");
    });

    it("compositionend後、次のイベントループではEnterが通るがテキストは変換されない", async () => {
      const editor = createSlateEditor("入力テスト");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;

      // compositionend発火
      leaf.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));

      // 次のイベントループまで待つ
      await new Promise((resolve) => setTimeout(resolve, 10));

      const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      leaf.dispatchEvent(enterEvent);

      // Enterはブロックされない（defaultPreventedがfalse）
      expect(enterEvent.defaultPrevented).toBe(false);
      // しかしテキストは変換されない（fetch側で処理するため）
      expect(leaf.textContent).toBe("入力テスト");
    });

    it("Shift+Enterではテキストが変換されない（改行目的）", () => {
      const editor = createSlateEditor("入力テスト");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          shiftKey: true,
        })
      );

      expect(leaf.textContent).toBe("入力テスト");
    });

    it("arrow_forward付き「作成」ボタンclickでテキストが変換されない（fetch側で処理）", () => {
      const editor = createSlateEditor("日本語");
      const button = createSubmitButton();
      document.body.appendChild(editor);
      document.body.appendChild(button);
      mockEditorAPIs();
      setupUnicodeEscape();

      button.click();

      const leaf = editor.querySelector('[data-slate-leaf="true"]');
      expect(leaf?.textContent).toBe("日本語");
    });

    it("add_2アイコンの「作成」ボタン（添付ボタン）では変換されない", () => {
      const editor = createSlateEditor("日本語");
      const attachBtn = createAttachButton();
      document.body.appendChild(editor);
      document.body.appendChild(attachBtn);
      mockEditorAPIs();
      setupUnicodeEscape();

      attachBtn.click();

      const leaf = editor.querySelector('[data-slate-leaf="true"]');
      expect(leaf?.textContent).toBe("日本語");
    });

    it("ASCII文字のみの場合は変換されない", () => {
      const editor = createSlateEditor("hello world");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(leaf.textContent).toBe("hello world");
    });

    it("Slateエディタが後から追加された場合MutationObserverで検知する", async () => {
      mockEditorAPIs();
      setupUnicodeEscape();

      const editor = createSlateEditor("遅延追加");
      document.body.appendChild(editor);

      await new Promise((resolve) => setTimeout(resolve, 0));

      // エディタが検知されたことを確認（テキストは変換されない）
      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      expect(leaf.textContent).toBe("遅延追加");
    });

    it("表示エリアの\\uXXXXテキストが自動デコードされる", async () => {
      mockEditorAPIs();
      setupUnicodeEscape();

      const div = document.createElement("div");
      div.textContent = "\\u30C6\\u30B9\\u30C8";
      document.body.appendChild(div);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("テスト");
    });

    it("表示エリアのASCIIテキストはデコードされない", async () => {
      mockEditorAPIs();
      setupUnicodeEscape();

      const div = document.createElement("div");
      div.textContent = "hello world";
      document.body.appendChild(div);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("hello world");
    });

    it("初回アクセス時に既存DOMの\\uXXXXテキストがデコードされる", async () => {
      const div = document.createElement("div");
      div.textContent = "\\u30C6\\u30B9\\u30C8";
      document.body.appendChild(div);

      mockEditorAPIs();
      setupUnicodeEscape();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("テスト");
    });

    it("「プロンプトを再利用」ボタンclickでエディタがデコードされる", async () => {
      const editor = createSlateEditor("\\u30C6\\u30B9\\u30C8 reuse");
      const reuseBtn = createReuseButton();
      document.body.appendChild(editor);
      document.body.appendChild(reuseBtn);
      mockEditorAPIs();
      setupUnicodeEscape();

      reuseBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const leaf = editor.querySelector('[data-slate-leaf="true"]');
      expect(leaf?.textContent).toBe("テスト reuse");
    });

    it("表示エリアの「正面からのアングル」エスケープが正しくデコードされる", async () => {
      mockEditorAPIs();
      setupUnicodeEscape();

      const div = document.createElement("div");
      div.textContent =
        " \\u6B63\\u9762\\u304B\\u3089\\u306E\\u30A2\\u30F3\\u30B0\\u30EB";
      document.body.appendChild(div);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(div.textContent).toBe("正面からのアングル");
    });
  });

  describe("fetch インターセプト", () => {
    const TARGET_URL = "https://aisandbox-pa.googleapis.com/v1:batchGenerateImages";
    const NON_TARGET_URL = "https://example.com/api/data";

    function createRequestBody(textValue: string): string {
      return JSON.stringify({
        requests: [
          {
            structuredPrompt: {
              parts: [
                { text: textValue },
              ],
            },
          },
        ],
      });
    }

    function createRequestBodyWithReference(textValue: string): string {
      return JSON.stringify({
        requests: [
          {
            structuredPrompt: {
              parts: [
                { text: textValue },
                { inlineData: { mimeType: "image/png", data: "base64data..." } },
              ],
            },
          },
        ],
      });
    }

    it("対象URLのリクエストbodyのtextパートがエスケープされる", async () => {
      // モックfetchをセット（installFetchInterceptorがラップする対象）
      const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
      window.fetch = mockFetch;

      mockEditorAPIs();
      setupUnicodeEscape();

      // インターセプトされたfetchでリクエスト発行
      const body = createRequestBody("日本語テスト");
      await window.fetch(TARGET_URL, {
        method: "POST",
        body,
      });

      // モックfetchに渡されたbodyを検証
      const calledBody = mockFetch.mock.calls[0][1]?.body as string;
      const parsed = JSON.parse(calledBody);
      // textパートがエスケープされていること
      expect(parsed.requests[0].structuredPrompt.parts[0].text).toBe(
        " \\u65E5\\u672C\\u8A9E\\u30C6\\u30B9\\u30C8"
      );
    });

    it("非対象URLのリクエストはそのまま通す", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
      window.fetch = mockFetch;

      mockEditorAPIs();
      setupUnicodeEscape();

      const body = createRequestBody("日本語テスト");
      await window.fetch(NON_TARGET_URL, {
        method: "POST",
        body,
      });

      // bodyが変更されていないこと
      const calledBody = mockFetch.mock.calls[0][1]?.body as string;
      const parsed = JSON.parse(calledBody);
      expect(parsed.requests[0].structuredPrompt.parts[0].text).toBe("日本語テスト");
    });

    it("referenceパートは変更されない", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
      window.fetch = mockFetch;

      mockEditorAPIs();
      setupUnicodeEscape();

      const body = createRequestBodyWithReference("日本語テスト");
      await window.fetch(TARGET_URL, {
        method: "POST",
        body,
      });

      const calledBody = mockFetch.mock.calls[0][1]?.body as string;
      const parsed = JSON.parse(calledBody);
      // textパートはエスケープされる
      expect(parsed.requests[0].structuredPrompt.parts[0].text).toBe(
        " \\u65E5\\u672C\\u8A9E\\u30C6\\u30B9\\u30C8"
      );
      // referenceパート（inlineData）は変更されない
      expect(parsed.requests[0].structuredPrompt.parts[1].inlineData).toEqual({
        mimeType: "image/png",
        data: "base64data...",
      });
      // referenceパートにtextが追加されていないこと
      expect(parsed.requests[0].structuredPrompt.parts[1].text).toBeUndefined();
    });
  });
});
