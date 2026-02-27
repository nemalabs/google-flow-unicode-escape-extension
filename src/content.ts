import { escapeUnicode, unescapeUnicode } from "./utils/unicode";

const SLATE_EDITOR_SELECTOR = '[data-slate-editor="true"]';
const UNICODE_ESCAPE_RE = /\\u[0-9A-Fa-f]{4}/;
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

let escaping = false;
let justComposed = false;

function getSlateEditor(): HTMLElement | null {
  return document.querySelector(SLATE_EDITOR_SELECTOR);
}

function getEditorText(editor: HTMLElement): string {
  if (editor.querySelector('[data-slate-placeholder="true"]')) {
    return "";
  }
  // Slateは改行を別の<p>要素で表現するため、各pのテキストを\nで結合
  const paragraphs = editor.querySelectorAll('[data-slate-node="element"]');
  if (paragraphs.length > 0) {
    return Array.from(paragraphs).map(p => p.textContent || "").join("\n");
  }
  return editor.textContent || "";
}

function setEditorText(editor: HTMLElement, text: string): void {
  editor.focus();

  // selectAll + selectionchangeでSlateの内部Selectionを全選択に同期
  document.execCommand("selectAll");
  document.dispatchEvent(new Event("selectionchange"));

  // beforeinput(insertFromPaste) + DataTransferでSlateの内部状態を更新
  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/plain", text);
  const beforeInputEvent = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertFromPaste",
    dataTransfer,
  });
  editor.dispatchEvent(beforeInputEvent);
}

function convertEditor(): void {
  const editor = getSlateEditor();
  if (!editor) return;

  const before = getEditorText(editor);
  if (!before) return;

  const after = escapeUnicode(before);
  if (before === after) return;

  escaping = true;
  setEditorText(editor, after);
  escaping = false;
}

function decodeEditorValue(): void {
  const editor = getSlateEditor();
  if (!editor) return;

  const text = getEditorText(editor);
  if (!text || !UNICODE_ESCAPE_RE.test(text)) return;

  setEditorText(editor, unescapeUnicode(text));
}


function isSubmitButton(el: Element): boolean {
  const button = el.closest("button");
  if (!button) return false;
  const icon = button.querySelector("i");
  const iconText = icon?.textContent?.trim() || "";
  return iconText === "arrow_forward" && (button.textContent || "").includes("作成");
}

function isReuseButton(el: Element): boolean {
  const button = el.closest("button");
  if (!button) return false;
  return (button.textContent || "").includes("プロンプトを再利用");
}

function attachEvents(): void {
  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as Element;
      if (isSubmitButton(target)) {
        convertEditor();
      }
      if (isReuseButton(target)) {
        let attempts = 0;
        const timer = setInterval(() => {
          attempts++;
          decodeEditorValue();
          if (attempts >= 20) clearInterval(timer);
        }, 50);
      }
    },
    true
  );

  // ChromeではIME確定時に compositionend → keydown(Enter, isComposing:false) の順で来る
  // compositionend直後のEnterをアプリに届かないように完全ブロック
  document.addEventListener("compositionend", () => {
    justComposed = true;
    setTimeout(() => { justComposed = false; }, 0);
  }, true);

  function blockIMEEnter(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest?.(SLATE_EDITOR_SELECTOR)) return;
    if (e.key !== "Enter") return;

    if (e.isComposing || justComposed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    // keydownのみ: 通常のEnter送信時にconvertEditor発動
    if (e.type === "keydown" && !e.shiftKey) {
      convertEditor();
    }
  }

  // keydown, keypress, keyup すべてでIME確定Enterをブロック
  document.addEventListener("keydown", blockIMEEnter, true);
  document.addEventListener("keypress", blockIMEEnter, true);
  document.addEventListener("keyup", blockIMEEnter, true);
}

function decodeDisplayedText(node: Node): void {
  if (node.nodeType === TEXT_NODE) {
    const text = node.textContent || "";
    if (UNICODE_ESCAPE_RE.test(text)) {
      node.textContent = unescapeUnicode(text);
    }
    return;
  }
  if (node.nodeType === ELEMENT_NODE) {
    if ((node as Element).closest?.(SLATE_EDITOR_SELECTOR)) return;
    node.childNodes.forEach((child) => decodeDisplayedText(child));
  }
}

function observeDisplayArea(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target;

      // Slateエディタ内の変更は無視（内部状態と競合するため）
      const targetEl = target.nodeType === ELEMENT_NODE
        ? (target as Element)
        : target.parentElement;
      if (targetEl?.closest?.(SLATE_EDITOR_SELECTOR)) {
        continue;
      }

      if (mutation.type === "characterData" && target) {
        decodeDisplayedText(target);
      }
      for (const added of mutation.addedNodes) {
        if (added.nodeType === ELEMENT_NODE && (added as Element).closest?.(SLATE_EDITOR_SELECTOR)) {
          continue;
        }
        decodeDisplayedText(added);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

export function setupUnicodeEscape(): void {
  attachEvents();
  decodeDisplayedText(document.body);
  observeDisplayArea();

  if (!getSlateEditor()) {
    const observer = new MutationObserver(() => {
      if (getSlateEditor()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

if (typeof window !== "undefined") {
  setupUnicodeEscape();
}
