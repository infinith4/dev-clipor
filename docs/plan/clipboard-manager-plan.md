# Clipboard Manager 開発プラン

## Context

Windows 11向けのクリップボードマネージャーツールを開発する。Controlキーを連続2回押下でクリップボード履歴のポップアップを表示し、過去のコピー内容を選択・貼り付けできるツール。Clibor（https://chigusa-web.com/clibor/）に類似した機能を持つ。

## 技術選定: Rust + Tauri v2

| 選択肢 | 判定 | 理由 |
|--------|------|------|
| **Rust + Tauri v2** | **採用** | 軽量バイナリ（数MB）、メモリ消費極小、Win32 API直接呼出し可能（windowsクレート）、フロントエンドはReact/TypeScript（プロジェクト既存スキルと整合）、システムトレイ対応ネイティブ |
| C# WPF | 不採用 | .NETランタイム依存、バイナリサイズ大 |
| Electron | 不採用 | メモリ重い（100MB+）、常駐ツールには不適 |
| TypeScript/Node | 不採用 | 低レベルキーボードフック不可 |

### Tauri v2 採用の利点
- **バイナリサイズ**: 約3-5MB（Electronの1/30以下）
- **メモリ使用量**: 約10-20MB（Electronの1/10以下）
- **フロントエンド**: React + TypeScript（プロジェクト既存のフロントエンド技術と一致）
- **バックエンド**: Rustで高速・安全なシステム操作
- **Tauri v2機能**: システムトレイ、グローバルショートカット、クリップボード操作がプラグインで提供済み

## アーキテクチャ

```
┌──────────────────────────────────────────┐
│         システムトレイアイコン              │
│  (tauri-plugin-system-tray)              │
└────────────┬─────────────┬───────────────┘
             │             │
             v             v
┌─────────────────┐ ┌───────────────────┐
│ HotkeyDetector  │ │ ClipboardMonitor  │
│ (rdev crate /   │ │ (clipboard-win    │
│  Windows raw    │ │  crate + Win32    │
│  input hook)    │ │  listener)        │
└────────┬────────┘ └─────────┬─────────┘
         │                    │
         v                    v
┌──────────────────────────────────────────┐
│       ClipboardHistoryStore              │
│  (SQLite via rusqlite crate)             │
└────────────────────┬─────────────────────┘
                     │
                     v
┌──────────────────────────────────────────┐
│       Popup Window (Tauri WebView)       │
│  React + TypeScript フロントエンド        │
│  (ボーダーレス、カーソル位置に表示、        │
│   フィルタ可能なリスト)                    │
└──────────────────────────────────────────┘
```

### データフロー
1. **ClipboardMonitor** (Rust): `clipboard-win`クレートでクリップボード変更を監視。変更検出時にテキストを`ClipboardHistoryStore`に保存
2. **ClipboardHistoryStore** (Rust): `rusqlite`でSQLiteに永続化。SHA256ハッシュで重複排除
3. **HotkeyDetector** (Rust): `rdev`クレートまたはWin32 `SetWindowsHookEx`でグローバルキーボードフック。Ctrl2回連続押下を検出
4. **Popup** (React): Tauri IPC経由で履歴を取得・表示。アイテム選択時にRust側でクリップボードセット＋Ctrl+Vシミュレーション

## 主要Rustクレート

| クレート | 用途 |
|---------|------|
| `tauri` (v2) | アプリフレームワーク |
| `tauri-plugin-clipboard-manager` | クリップボード操作 |
| `rdev` | グローバルキーボード/マウスイベント監視 |
| `clipboard-win` | Windows クリップボード低レベル操作 |
| `rusqlite` | SQLite データベース |
| `sha2` | SHA256ハッシュ（重複排除） |
| `serde` / `serde_json` | シリアライゼーション |
| `chrono` | タイムスタンプ管理 |
| `windows` | Win32 API呼出し（SendInput等） |
| `single-instance` | 多重起動防止 |

## 開発フェーズ

### Phase 1: プロジェクトセットアップ & コアインフラ
- `cargo create-tauri-app` でTauri v2プロジェクト生成（フロントエンド: React + TypeScript）
- SQLiteデータベーススキーマ作成（`rusqlite`）
- `ClipboardMonitor` 実装（`clipboard-win` + バックグラウンドスレッド）
- Tauri Commandで履歴取得API定義
- **完了基準**: アプリ起動→他アプリでコピー→SQLiteに保存→Tauriコマンドで履歴取得確認

### Phase 2: ホットキー検出
- `rdev`クレートによるグローバルキーボードリスナー（別スレッド）
- Ctrl Key-upイベントの300ms閾値検出
- 他キー押下を挟んだ場合のリセットロジック（Ctrl+C等の誤検知防止）
- 検出時にTauriウィンドウ表示イベント発火
- **完了基準**: Ctrl2回押下→コンソールログ or ウィンドウ表示イベント確認

### Phase 3: ポップアップUI (React)
- Tauriウィンドウ設定: `decorations: false`, `transparent: true`, `always_on_top: true`
- カーソル位置にウィンドウ配置（Rust側で`GetCursorPos`→ウィンドウ位置セット）
- Reactコンポーネント: 検索バー + クリップボード履歴リスト
- **ページネーション**: 1ページあたりの表示件数を設定可能（デフォルト20件）。次ページ/前ページボタンまたはスクロールで切り替え
- **履歴上限管理**: 保存上限（デフォルト1000件）に達したら古いエントリから自動削除（ピン留めアイテムは保持）
- **タブ切り替え**: 「履歴」タブと「定型文」タブを切り替え可能
- アイテム選択→Tauriコマンド呼出し→Rust側でクリップボードセット＋`SendInput`でCtrl+V
- Escキー/フォーカス喪失で閉じる
- **完了基準**: Ctrl2回→ポップアップ表示→ページ送り動作→選択→貼り付け動作

### Phase 4: 定型文（テンプレート）機能
- 定型文の登録・編集・削除（設定画面またはポップアップから）
- グループ/カテゴリ分け（例: 挨拶文、署名、コードスニペット等）
- ポップアップの「定型文」タブから素早く選択・貼り付け
- 定型文内の変数プレースホルダー対応（例: `{{date}}` → 当日日付に自動置換）
- インポート/エクスポート（JSON形式）
- **完了基準**: 定型文を登録→ポップアップから選択→貼り付け動作

### Phase 5: システムトレイ統合
- `tauri-plugin-system-tray`でトレイアイコン設定
- 右クリックメニュー: 履歴表示 / 定型文管理 / 設定 / 終了
- タスクバー非表示（トレイのみ常駐）
- 設定画面（React）: 最大履歴数、1ページ表示件数、Ctrl2回閾値、自動起動トグル
- Windows自動起動（レジストリ操作）
- **完了基準**: トレイ常駐動作、設定保存・復元

### Phase 6: テスト・品質向上
- Rust側: `#[cfg(test)]`ユニットテスト（履歴ストア、ホットキー判定ロジック、定型文CRUD、自動クリーンアップ）
- フロントエンド: Vitest + React Testing Library（ページネーション、タブ切り替え）
- エッジケース: 大テキスト（100KB上限トランケート）、Unicode/絵文字、非テキストデータ
- パフォーマンス: 遅延読込、上限到達時の自動削除
- `cargo tauri build`でインストーラー生成（MSI/NSIS）
- **完了基準**: `cargo test` & `npm test` 全パス、インストーラー生成成功

## ディレクトリ構成

```
clipboard-manager/
  src-tauri/                            # Rust バックエンド
    Cargo.toml
    tauri.conf.json                     # Tauri設定（ウィンドウ、トレイ等）
    src/
      main.rs                           # エントリポイント
      lib.rs                            # Tauriアプリ設定・プラグイン登録
      commands/
        mod.rs
        clipboard.rs                    # Tauriコマンド（履歴取得・削除・ピン等）
        template.rs                     # 定型文コマンド（CRUD・インポート/エクスポート）
        settings.rs                     # 設定コマンド
      services/
        mod.rs
        clipboard_monitor.rs            # クリップボード変更監視
        clipboard_history_store.rs      # SQLite履歴管理（ページネーション・自動クリーンアップ）
        template_store.rs               # 定型文管理（グループ・変数置換）
        hotkey_detector.rs              # Ctrl2回検出
        paste_service.rs                # SendInputによる貼り付け
        settings_service.rs             # 設定管理
      models/
        mod.rs
        clipboard_entry.rs              # エントリモデル
        template.rs                     # 定型文モデル（グループ・変数プレースホルダー）
        app_settings.rs                 # 設定モデル
      native/
        mod.rs
        win32.rs                        # Win32 API呼出し（unsafe）
    icons/
      icon.ico
  src/                                  # React フロントエンド
    main.tsx                            # エントリポイント
    App.tsx                             # ルートコンポーネント
    components/
      PopupWindow.tsx                   # 履歴ポップアップ（タブ切り替え）
      ClipboardItem.tsx                 # 履歴アイテム
      TemplateList.tsx                  # 定型文リスト
      TemplateEditor.tsx                # 定型文登録・編集
      Pagination.tsx                    # ページネーション
      SearchBar.tsx                     # 検索バー
      SettingsView.tsx                  # 設定画面
    hooks/
      useClipboardHistory.ts            # 履歴取得フック（ページネーション対応）
      useTemplates.ts                   # 定型文フック
      useSettings.ts                    # 設定フック
    types/
      index.ts                          # 型定義
    styles/
      popup.css                         # ポップアップスタイル
  package.json
  tsconfig.json
  vite.config.ts
```

## DBスキーマ (SQLite)

保存先: `%LOCALAPPDATA%/ClipboardManager/history.db`

```sql
CREATE TABLE IF NOT EXISTS clipboard_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    text_hash TEXT NOT NULL,       -- SHA256 (重複排除用)
    copied_at TEXT NOT NULL,       -- ISO 8601
    source_app TEXT,               -- コピー元アプリ名
    is_pinned INTEGER DEFAULT 0,   -- ピン留め
    char_count INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_text_hash ON clipboard_entries(text_hash);
CREATE INDEX IF NOT EXISTS idx_copied_at ON clipboard_entries(copied_at DESC);

-- 定型文グループ
CREATE TABLE IF NOT EXISTS template_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,        -- グループ名（例: 挨拶文、署名）
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL           -- ISO 8601
);

-- 定型文エントリ
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    title TEXT NOT NULL,               -- 表示用タイトル
    text TEXT NOT NULL,                -- 本文（{{date}}等の変数プレースホルダー可）
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,          -- ISO 8601
    updated_at TEXT NOT NULL,          -- ISO 8601
    FOREIGN KEY (group_id) REFERENCES template_groups(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_templates_group ON templates(group_id, sort_order);
```

重複排除: 同じ`text_hash`が既存の場合、`copied_at`を更新して最新に移動。

履歴上限管理: 保存件数が設定上限（デフォルト1000件）に達した場合、`is_pinned = 0`のエントリを`copied_at`昇順で自動削除。

定型文変数プレースホルダー:

| 変数 | 置換内容 |
|------|---------|
| `{{date}}` | 当日日付（例: 2026-03-18） |
| `{{time}}` | 現在時刻（例: 14:30:00） |
| `{{datetime}}` | 日時（例: 2026-03-18 14:30:00） |
| `{{clipboard}}` | 現在のクリップボード内容 |

## 技術的課題と対策

| 課題 | 対策 |
|------|------|
| Ctrl2回検出の誤検知 | `rdev`でKey-upイベントのみカウント、間に他キー押下があればリセット |
| クリップボード自己監視ループ | `AtomicBool`フラグで自身のセット時は無視 |
| マルチモニタ/高DPI対応 | Tauri v2のDPI Awareness自動対応 + `GetCursorPos`で正確な位置取得 |
| `rdev`のスレッドブロッキング | `rdev::listen`は別スレッドで実行、`mpsc::channel`でメインスレッドに通知 |
| アンチウイルスによるフックブロック | ドキュメントに除外設定を記載、フォールバックとして`RegisterHotKey`を検討 |
| 多重起動防止 | `single-instance`プラグインまたはNamed Mutex |
| 大きなテキスト | 100KB上限でトランケート |
| Rustのunsafeコード | Win32 API呼出しは`native/win32.rs`に集約、最小限のunsafeブロック |

## コマンド

```bash
# 前提: Rust toolchain + Node.js がインストール済み

# セットアップ
cd clipboard-manager
npm install
cargo install tauri-cli --version "^2"

# 開発モード（ホットリロード）
cargo tauri dev

# Rustテスト
cd src-tauri && cargo test

# フロントエンドテスト
npm test

# ビルド（インストーラー生成）
cargo tauri build
# 出力: src-tauri/target/release/bundle/msi/*.msi
#        src-tauri/target/release/bundle/nsis/*.exe
```

## 検証方法

1. `cargo tauri dev` でアプリが起動すること
2. アプリ起動→テキストをコピー→SQLiteにエントリが保存されること
3. Ctrl2回押下→ポップアップがカーソル位置に表示されること
4. ポップアップで検索→フィルタされたリスト表示
5. ページネーション: 設定件数を超える履歴がある場合、次ページ/前ページで切り替え可能
6. 履歴上限: 上限到達時に古いエントリ（ピン留め以外）が自動削除されること
7. 定型文: 登録→グループ分類→ポップアップ「定型文」タブから選択→貼り付け動作
8. 定型文変数: `{{date}}`等のプレースホルダーが貼り付け時に自動置換されること
9. 定型文インポート/エクスポート: JSON形式で正常にラウンドトリップ
10. アイテム選択→対象アプリに貼り付けされること
11. システムトレイに常駐し、右クリックメニューが動作すること
12. `cargo test` & `npm test` が全テストパスすること
13. `cargo tauri build` でMSI/NSISインストーラー生成成功

## 修正対象ファイル

- 新規作成: `clipboard-manager/src-tauri/` 配下全ファイル（Rustバックエンド）
- 新規作成: `clipboard-manager/src/` 配下全ファイル（Reactフロントエンド）
- 新規作成: `clipboard-manager/package.json`, `tsconfig.json`, `vite.config.ts`
- 新規作成: `docs/plan/clipboard-manager-plan.md`（このプラン）

## 実績差分

本計画に対して、実装と検証の過程で以下の差分が発生した。

### ホットキー仕様の変更

- 計画時点では `Ctrl` 2回押下を前提としていた
- 実装では既定ホットキーを `Ctrl+Alt+Z` に変更した
- 設定画面からホットキー文字列を変更可能にした
- `rdev` 前提の案から変更し、Windows `RegisterHotKey` ベースで実装した

### ウィンドウ表示仕様の変更

- 当初案ではカーソル位置表示を中心に想定していた
- 実装では画面外表示を避けるため、表示領域内に収まるよう補正したうえで中央寄せを採用した
- 透明ウィンドウは見えなくなる問題が発生したため無効化した
- フォーカス喪失時に閉じる挙動は維持しつつ、表示直後に閉じないようガード時間を追加した

### UI 初期化まわりの差分

- release ビルドで白画面が発生したため、`getCurrentWindow()` のトップレベル実行を廃止した
- React Error Boundary を追加し、起動時例外を画面上で確認できるようにした
- Vite の `base` を `./` に変更し、アセット参照を相対パス化した

### 履歴・定型文タブの表示仕様変更

- 計画時点では一般的なポップアップ幅を想定していた
- 実装では履歴タブ・定型文タブを `230px` 幅のコンパクト表示へ変更した
- 余白を極力削減し、狭い幅でも操作できるよう 1 列レイアウトに寄せた
- 設定タブは入力欄の都合で別幅のままとした

### 操作方式の変更

- 当初案では各項目に対する直接操作ボタンを前提にしていた
- 実装では履歴・定型文ともに、クリックまたは方向キーで選択し `Enter` で貼り付ける方式に変更した
- `Pin` / `Paste` / `Delete` ボタンは一覧から削除した
- 選択状態を視覚表示し、`↑` `↓` による選択移動を追加した

### ビルド運用の差分

- frontend 変更後に `cargo build --release` のみで差し替えると白画面化するケースがあった
- 実運用では `npx tauri build --bundles msi,nsis -- --target-dir target-alt` を正式な反映手順とした
- 生成物は `target-alt` 配下の `exe` / `msi` / `nsis` を使用している

### 未実装・継続課題

- `source_app` の取得は未実装
- 多重起動防止は未実装
- 定型文インポート/エクスポートは現状 JSON テキストベースで、ファイルダイアログ統合は未実装
