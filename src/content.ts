import { escapeUnicode, unescapeUnicode } from "./utils/unicode";

const TEXTAREA_ID = "PINHOLE_TEXT_AREA_ELEMENT_ID";
const UNICODE_ESCAPE_RE = /\\u[0-9A-Fa-f]{4}/;

let escaping = false;

function getTextArea(): HTMLTextAreaElement | null {
  return document.getElementById(
    TEXTAREA_ID
  ) as HTMLTextAreaElement | null;
}

function convertTextArea(): void {
  const textarea = getTextArea();
  if (!textarea) return;

  const before = textarea.value;
  const after = escapeUnicode(before);
  if (before === after) return;

  escaping = true;
  textarea.value = after;
  escaping = false;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function decodeTextAreaValue(): void {
  const textarea = getTextArea();
  if (!textarea || !UNICODE_ESCAPE_RE.test(textarea.value)) return;

  textarea.value = unescapeUnicode(textarea.value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function getButtonLabel(el: Element): string {
  const button = el.closest("button");
  if (!button) return "";
  return button.textContent || "";
}

function isSubmitButton(el: Element): boolean {
  return getButtonLabel(el).includes("作成");
}

function isReuseButton(el: Element): boolean {
  return getButtonLabel(el).includes("プロンプトを再利用");
}

function attachEvents(): void {
  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as Element;
      if (isSubmitButton(target)) {
        convertTextArea();
      }
      if (isReuseButton(target)) {
        // interceptTextAreaValueが効かない場合のフォールバック
        // SPAが値を設定するまで50ms間隔でリトライ（最大1秒）
        let attempts = 0;
        const timer = setInterval(() => {
          attempts++;
          decodeTextAreaValue();
          if (attempts >= 20) clearInterval(timer);
        }, 50);
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      const target = e.target as Element;
      if (e.key === "Enter" && !e.isComposing && !e.shiftKey && target.id === TEXTAREA_ID) {
        convertTextArea();
      }
    },
    true
  );
}

function decodeDisplayedText(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    if (UNICODE_ESCAPE_RE.test(text)) {
      node.textContent = unescapeUnicode(text);
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    node.childNodes.forEach((child) => decodeDisplayedText(child));
  }
}

function interceptTextAreaValue(): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  );
  if (!descriptor || !descriptor.set) return;

  const originalSet = descriptor.set;
  let decoding = false;

  Object.defineProperty(HTMLTextAreaElement.prototype, "value", {
    get: descriptor.get,
    set(newValue: string) {
      originalSet.call(this, newValue);
      if (decoding || escaping) return;
      if (this.id === TEXTAREA_ID && UNICODE_ESCAPE_RE.test(newValue)) {
        decoding = true;
        originalSet.call(this, unescapeUnicode(newValue));
        decoding = false;
      }
    },
    configurable: true,
    enumerable: true,
  });
}

function observeDisplayArea(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target) {
        decodeDisplayedText(mutation.target);
      }
      for (const added of mutation.addedNodes) {
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
  interceptTextAreaValue();
  decodeDisplayedText(document.body);
  observeDisplayArea();

  // textareaが未存在の場合、動的追加を監視
  if (!getTextArea()) {
    const observer = new MutationObserver(() => {
      if (getTextArea()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

if (typeof window !== "undefined") {
  setupUnicodeEscape();
}
