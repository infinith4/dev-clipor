# Clipor

[日本語](README.md) | [English](README.en.md)

![C0 (statements)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/infinith4/dev-clipor/gh-pages-badges/c0-coverage.json)
![C1 (branches)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/infinith4/dev-clipor/gh-pages-badges/c1-coverage.json)
![C2 (functions)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/infinith4/dev-clipor/gh-pages-badges/c2-coverage.json)

Windows 向けのクリップボードマネージャーアプリケーションです。クリップボードの履歴管理、テンプレート機能、パスワード保護によるセキュアな運用が可能です。

## インストール

<table>
  <tr>
    <td align="center" width="33%">
      <b>Microsoft Store</b><br><br>
      <a href="https://apps.microsoft.com/detail/9P0CRL2FRKF9?hl=ja&gl=JP&ocid=pdpshare">
        <img src="https://developer.microsoft.com/store/badges/images/Japanese_get-it-from-MS.png" alt="Microsoft Store からダウンロード" width="180">
      </a>
    </td>
    <td align="center" width="33%">
      <b>MSI インストーラー</b><br><br>
      <a href="https://github.com/infinith4/dev-clipor/releases/latest">
        <img src="https://img.shields.io/badge/MSI-ダウンロード-0078D4?style=for-the-badge&logo=windows" alt="MSI ダウンロード">
      </a><br><br>
      <sub>Windows Installer 形式（推奨）</sub>
    </td>
    <td align="center" width="33%">
      <b>NSIS セットアップ</b><br><br>
      <a href="https://github.com/infinith4/dev-clipor/releases/latest">
        <img src="https://img.shields.io/badge/NSIS-ダウンロード-0078D4?style=for-the-badge&logo=windows" alt="NSIS ダウンロード">
      </a><br><br>
      <sub>セットアップ実行ファイル</sub>
    </td>
  </tr>
</table>

## 主な機能

- **クリップボード履歴** - コピーした内容を自動的に記録し、検索・フィルタリングが可能
- **ピン留め** - よく使うエントリをピン留めして常にアクセスしやすい位置に保持
- **テンプレート** - よく使うテキストをテンプレートとして保存・管理（インポート/エクスポート対応）
- **テキスト変換** - 全角⇔半角変換、空白トリムなどのテキスト整形
- **パスワード保護** - AES-256-GCM 暗号化によるクリップボード履歴の保護
- **ホバープレビュー** - マウスカーソルを乗せると内容の全文をツールチップで表示
- **グローバルホットキー** - `Ctrl+Alt+Z` (変更可能)でポップアップを即座に呼び出し
- **スタートアップ起動** - Windows 起動時の自動起動設定

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19.2 + TypeScript 6.0 + Vite 8.0 |
| バックエンド | Rust + Tauri 2.10 |
| データベース | SQLite (rusqlite 0.39, bundled) |
| 暗号化 | AES-256-GCM + PBKDF2 |
| テスト | Vitest 4.1 + Testing Library 16.3 |

## 必要環境

- **Node.js** 24 以上
- **Rust** (stable toolchain)
- **Windows** (clipboard-win / Windows API を使用)

## 使い方

1. インストーラー (MSI または NSIS) を実行してインストール
2. アプリ起動後、システムトレイにアイコンが表示される
3. `Ctrl+Alt+Z` でクリップボード履歴のポップアップを表示
4. ポップアップには 3 つのタブがある:
   - **履歴** - コピーしたテキストの一覧。検索・ピン留め・削除が可能
   - **テンプレート** - よく使うテキストの登録・呼び出し
   - **設定** - 履歴保持数、スタートアップ起動、パスワード保護などの設定

## ビルド方法

<details>
<summary>ビルド手順を表示</summary>

### 開発モード

```bash
cd clipor
npm install
npm run tauri dev
```

### テスト実行

```bash
cd clipor
npm test
```

### プロダクションビルド

```bash
cd clipor
npm ci
npm test
npm run tauri build
```

ビルド成果物は `clipor/src-tauri/target/release/` 以下に出力されます:

- `clipor.exe` - スタンドアロン実行ファイル
- `bundle/msi/*.msi` - MSI インストーラー
- `bundle/nsis/*.exe` - NSIS セットアップ

### CI/CD

GitHub Actions によるビルド・リリースが設定されています。`v*` 形式のタグをプッシュすると、Windows 環境でビルドが実行され、GitHub Releases にインストーラーが公開されます。

</details>

## データ保存先

- **クリップボード履歴**: `%LOCALAPPDATA%\Clipor\history.db` (SQLite)
- **設定ファイル**: `%LOCALAPPDATA%\Clipor\settings.json`

## プロジェクト構成

```
clipor/
├── src/                    # React フロントエンド
│   ├── App.tsx
│   ├── components/         # UIコンポーネント
│   ├── hooks/              # カスタムフック
│   ├── types/              # 型定義
│   └── styles/             # CSS
├── src-tauri/              # Rust バックエンド
│   ├── src/
│   │   ├── lib.rs          # アプリ初期化
│   │   ├── commands/       # Tauri コマンド
│   │   ├── models/         # データモデル
│   │   ├── services/       # ビジネスロジック
│   │   └── native/         # Windows API
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

## セキュリティについて

- クリップボード履歴はデフォルトでは**暗号化されずに** SQLite データベースに保存されます。パスワードや API キーなどの機密情報が履歴に残る可能性があります。パスワード保護を有効にすることで AES-256-GCM による暗号化が適用されます。
- 外部ネットワーク通信は一切行いません。すべてのデータはローカルに保存・処理されます。
- Windows レジストリへの書き込みはスタートアップ設定 (`HKEY_CURRENT_USER`) のみです。

## ライセンス

MIT
