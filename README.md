# Unicode Escape for Google Flow

[Google Flow](https://labs.google/fx/ja/tools/flow/) のテキストエリアで、非ASCII文字を自動的に Unicode エスケープシーケンス (`\uXXXX`) に変換する Chrome 拡張機能です。

## 機能

- **送信時の自動エスケープ** — 「作成」ボタンクリック / Enter キー押下時に、テキストエリア内の非ASCII文字 (日本語・絵文字など) を `\uXXXX` 形式に変換
- **表示テキストの自動デコード** — 画面上に表示された `\uXXXX` 形式のテキストを元の文字に自動変換
- **プロンプト再利用時のデコード** — 「プロンプトを再利用」ボタンで読み込まれたエスケープ済みテキストを自動デコード

## インストール

### 前提条件

- [Bun](https://bun.sh/) がインストールされていること

### ビルド

```bash
bun install
bun run build
```

### Chrome に読み込み

1. `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このプロジェクトのルートディレクトリを選択

## 対象 URL

`https://labs.google/fx/ja/tools/flow/*` 配下のページでのみ動作します。

> **Note:** 日本語UI (`/fx/ja/`) のみ対応しています。ボタンのトリガーが「作成」「プロンプトを再利用」など日本語テキストに依存しているため、他言語のUIでは動作しません。

## 開発

```bash
bun run test           # テスト実行
bun run test:watch     # テスト (ウォッチモード)
bun run test:coverage  # カバレッジ付きテスト
bun run build          # ビルド (dist/ に出力)
```

## プロジェクト構造

```
├── manifest.json          # Chrome Extension Manifest V3
├── src/
│   ├── content.ts         # Content Script (イベント処理・DOM監視)
│   └── utils/
│       └── unicode.ts     # Unicode エスケープ / デコード関数
├── tests/
│   ├── content.test.ts
│   └── unicode.test.ts
├── dist/                  # ビルド出力 (git管理外)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## License

MIT
