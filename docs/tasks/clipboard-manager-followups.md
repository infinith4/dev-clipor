# Clipboard Manager 対応記録

## 概要

`clipboard-manager/` に対して、ポップアップ表示、ホットキー、UI 操作、ビルド反映まわりの修正を実施した。

## 対応内容

### 1. ホットキーを `Ctrl+Alt+Z` に変更

- 既定ホットキーを `Ctrl+Alt+Z` に変更
- 設定画面からホットキー文字列を変更可能にした
- Hotkey 検出を Windows `RegisterHotKey` ベースに変更して安定化した

対象:
- `clipboard-manager/src-tauri/src/services/hotkey_detector.rs`
- `clipboard-manager/src-tauri/src/services/settings_service.rs`
- `clipboard-manager/src-tauri/src/models/app_settings.rs`
- `clipboard-manager/src/components/SettingsView.tsx`

### 2. ポップアップが見えない問題の修正

- 透明ウィンドウを無効化した
- ポップアップ位置を画面外に出さないよう調整した
- モニタの表示領域内に収まるように中央配置へ変更した
- フォーカス喪失時に閉じる挙動を調整した

対象:
- `clipboard-manager/src-tauri/src/lib.rs`

### 3. 白画面問題の修正

- `getCurrentWindow()` のトップレベル実行を廃止し、起動後に初期化する形へ変更した
- React Error Boundary を追加し、起動時例外が発生しても真っ白のままにならないようにした
- Vite の `base` を `./` に変更し、release ビルド時のアセット参照を相対パス化した
- frontend 変更時は `cargo build` ではなく `npx tauri build` で正式ビルドする運用に切り替えた

対象:
- `clipboard-manager/src/App.tsx`
- `clipboard-manager/src/main.tsx`
- `clipboard-manager/src/components/AppErrorBoundary.tsx`
- `clipboard-manager/src/styles/popup.css`
- `clipboard-manager/vite.config.ts`

### 4. 履歴タブ・定型文タブの幅調整

- 履歴と定型文のウィンドウ幅を `230px` に変更した
- 設定タブは入力欄が潰れないよう別幅のままにした
- コンパクト表示では外側余白と装飾余白を削減した
- 220px 指定から 230px 指定へ再調整した

対象:
- `clipboard-manager/src/App.tsx`
- `clipboard-manager/src/components/PopupWindow.tsx`
- `clipboard-manager/src/styles/popup.css`
- `clipboard-manager/src-tauri/src/lib.rs`

### 5. 履歴・定型文の操作方式変更

- 各項目から `Pin` / `Paste` / `Delete` ボタンを削除した
- クリックで選択、`↑` `↓` で選択移動できるようにした
- `Enter` で貼り付ける操作に変更した
- 初期実装ではカード側が `Enter` を選択に消費していたため、`Enter` はグローバルで貼り付け専用になるよう修正した
- 選択状態を視覚的に分かるようにした

対象:
- `clipboard-manager/src/App.tsx`
- `clipboard-manager/src/components/ClipboardItem.tsx`
- `clipboard-manager/src/components/TemplateList.tsx`
- `clipboard-manager/src/components/PopupWindow.tsx`
- `clipboard-manager/src/styles/popup.css`

## ビルド・成果物

frontend を含む変更反映時は以下で正式ビルドしている。

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
npx tauri build --bundles msi,nsis -- --target-dir target-alt
```

更新済み成果物:

- `clipboard-manager/src-tauri/target-alt/release/clipboard-manager.exe`
- `clipboard-manager/src-tauri/target-alt/release/bundle/msi/Clipboard Manager_0.1.0_x64_en-US.msi`
- `clipboard-manager/src-tauri/target-alt/release/bundle/nsis/Clipboard Manager_0.1.0_x64-setup.exe`

## 確認済み項目

- `npm test`
- `npm run build`
- `cargo test --target-dir target-alt`
- `npx tauri build --bundles msi,nsis -- --target-dir target-alt`

## 補足

- frontend を変更した直後に `cargo build --release` のみで差し替えると、Tauri 側の frontend 資産反映とずれて白画面になることがあった
- そのため、UI を含む変更では `npx tauri build` を正とする
