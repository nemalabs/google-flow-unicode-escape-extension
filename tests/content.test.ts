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

  function createMultiLineSlateEditor(lines: string[]): HTMLDivElement {
    const editor = document.createElement("div");
    editor.setAttribute("data-slate-editor", "true");
    editor.setAttribute("contenteditable", "true");
    for (const line of lines) {
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
    return editor;
  }

  function createEmptySlateEditorWithPlaceholder(): HTMLDivElement {
    const editor = document.createElement("div");
    editor.setAttribute("data-slate-editor", "true");
    editor.setAttribute("contenteditable", "true");
    const placeholder = document.createElement("span");
    placeholder.setAttribute("data-slate-placeholder", "true");
    placeholder.textContent = "プロンプトを入力してください";
    editor.appendChild(placeholder);
    const p = document.createElement("p");
    p.setAttribute("data-slate-node", "element");
    const span = document.createElement("span");
    span.setAttribute("data-slate-node", "text");
    const leaf = document.createElement("span");
    leaf.setAttribute("data-slate-leaf", "true");
    leaf.textContent = "";
    span.appendChild(leaf);
    p.appendChild(span);
    editor.appendChild(p);
    return editor;
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
    it("Enterキー押下でSlateエディタのテキストが変換される", () => {
      const editor = createSlateEditor("入力テスト");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      const resultLeaf = editor.querySelector('[data-slate-leaf="true"]');
      expect(resultLeaf?.textContent).toBe(" \\u5165\\u529B\\u30C6\\u30B9\\u30C8");
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

    it("compositionend後、次のイベントループではEnterが通常通り動く", async () => {
      const editor = createSlateEditor("入力テスト");
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;

      // compositionend発火
      leaf.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));

      // 次のイベントループまで待つ
      await new Promise((resolve) => setTimeout(resolve, 10));

      leaf.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      const resultLeaf = editor.querySelector('[data-slate-leaf="true"]');
      expect(resultLeaf?.textContent).toBe(" \\u5165\\u529B\\u30C6\\u30B9\\u30C8");
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

    it("arrow_forward付き「作成」ボタンclickでテキストが変換される", () => {
      const editor = createSlateEditor("日本語");
      const button = createSubmitButton();
      document.body.appendChild(editor);
      document.body.appendChild(button);
      mockEditorAPIs();
      setupUnicodeEscape();

      button.click();

      const leaf = editor.querySelector('[data-slate-leaf="true"]');
      expect(leaf?.textContent).toBe(" \\u65E5\\u672C\\u8A9E");
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

    it("プレースホルダのみの場合は変換されない", () => {
      const editor = createEmptySlateEditorWithPlaceholder();
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      const placeholder = editor.querySelector('[data-slate-placeholder="true"]');
      expect(placeholder).toBeTruthy();
      expect(leaf.textContent).toBe("");
    });

    it("複数行テキストが改行付きで正しく変換される", () => {
      const editor = createMultiLineSlateEditor(["一行目", "二行目"]);
      document.body.appendChild(editor);
      mockEditorAPIs();
      setupUnicodeEscape();

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      const leaves = editor.querySelectorAll('[data-slate-leaf="true"]');
      expect(leaves[0]?.textContent).toBe(" \\u4E00\\u884C\\u76EE");
      expect(leaves[1]?.textContent).toBe("\\u4E8C\\u884C\\u76EE");
    });

    it("Slateエディタが後から追加された場合MutationObserverで検知する", async () => {
      mockEditorAPIs();
      setupUnicodeEscape();

      const editor = createSlateEditor("遅延追加");
      document.body.appendChild(editor);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const leaf = editor.querySelector('[data-slate-leaf="true"]')!;
      leaf.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      const resultLeaf = editor.querySelector('[data-slate-leaf="true"]');
      expect(resultLeaf?.textContent).toBe(" \\u9045\\u5EF6\\u8FFD\\u52A0");
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
});
