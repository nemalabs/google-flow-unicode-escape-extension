import { escapeUnicode } from "./unicode";

// TODO: Green Phase 実装ガイド
//
// 関数: escapePayloadTextParts(body: string): string
//
// 目的:
//   Google Labs FX の API リクエストペイロード (JSON文字列) を受け取り、
//   requests[].structuredPrompt.parts[] 内の "text" フィールドのみを
//   escapeUnicode() で変換して、変換後の JSON 文字列を返す。
//
// 入力: JSON文字列 (APIリクエストボディ)
// 出力: text パートのみエスケープ済みの JSON文字列
//
// ペイロード構造:
//   {
//     "requests": [{
//       "structuredPrompt": {
//         "parts": [
//           { "text": "..." },                    // <- この text を escapeUnicode() で変換
//           { "reference": { "media": {...} } }   // <- これは一切変更しない
//         ]
//       }
//     }]
//   }
//
// 実装手順:
//   1. body を JSON.parse() でパースする。失敗したら body をそのまま返す。
//   2. parsed.requests が配列でなければ body をそのまま返す。
//   3. 各 request について:
//      a. request.structuredPrompt?.parts が配列でなければスキップ
//      b. 各 part について:
//         - part に "text" プロパティ (string) があれば escapeUnicode(part.text) で置換
//         - "reference" など他のプロパティを持つ part は一切変更しない
//   4. JSON.stringify() で文字列に戻して返す。
//
// エッジケース:
//   - 不正な JSON → 元の文字列をそのまま返す
//   - structuredPrompt が無い request → スキップ (他の request は処理する)
//   - ASCII のみの text → escapeUnicode はそのまま返すので変更なし
//   - 複数の requests → すべて処理する
//
// 依存関数: escapeUnicode (src/utils/unicode.ts)
//   - 非ASCII文字を \uXXXX 形式に変換する
//   - 先頭が \u で始まる場合はスペースを付与する

export function escapePayloadTextParts(body: string): string {
  // TODO: 上記の実装手順に従って実装する
  return body;
}
