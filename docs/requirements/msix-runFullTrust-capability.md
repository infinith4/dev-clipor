# MSIX runFullTrust Capability Justification

Microsoft Store申請時の `runFullTrust` ケイパビリティ使用理由の記載内容。

## English (Store Submission Form)

> Clipor is a clipboard manager that requires the `runFullTrust` capability for the following reasons:
>
> 1. **Win32 Clipboard API access**: The app monitors and manages the Windows clipboard in real time using low-level Win32 APIs (`OpenClipboard`, `GetClipboardData`, `SetClipboardData`, `EmptyClipboard`). These APIs are not accessible within the MSIX sandbox without full trust.
>
> 2. **Global keyboard input injection**: To paste selected clipboard history items into any foreground application, the app uses `SendInput` (Win32 keyboard input API) to simulate Ctrl+V. This cross-process input injection requires full trust.
>
> 3. **Foreground window detection**: The app calls `GetForegroundWindow` and `GetWindowThreadProcessId` to identify which application is currently active, so it can paste content into the correct target. This requires full trust access.
>
> 4. **Startup registration**: The app supports a "launch on startup" feature by writing to `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run` in the Windows Registry.
>
> All of these features are core to the clipboard manager functionality and cannot be achieved through sandboxed WinRT APIs alone.

## 日本語

> Cliporはクリップボードマネージャーであり、以下の理由から `runFullTrust` が必要です。
>
> 1. **Win32クリップボードAPI**: リアルタイムでWindowsクリップボードを監視・操作するため、`OpenClipboard` / `GetClipboardData` / `SetClipboardData` 等のWin32 APIを使用しています。これらはMSIXサンドボックス内ではフルトラストなしにアクセスできません。
>
> 2. **グローバルキー入力の送信**: クリップボード履歴の項目を任意のアプリに貼り付けるため、`SendInput` でCtrl+Vをシミュレートしています。この他プロセスへの入力送信にはフルトラストが必要です。
>
> 3. **フォアグラウンドウィンドウの検出**: `GetForegroundWindow` / `GetWindowThreadProcessId` で現在アクティブなアプリを特定し、正しい貼り付け先を判断します。
>
> 4. **スタートアップ登録**: 「起動時に自動起動」機能のため、レジストリ `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` への書き込みが必要です。
>
> これらはすべてクリップボードマネージャーの中核機能であり、サンドボックス化されたWinRT APIでは代替できません。

## 対応するソースコード

| 機能 | ファイル | API |
|------|----------|-----|
| クリップボード監視・読み取り | `clipor/src-tauri/src/native/win32.rs` | `OpenClipboard`, `GetClipboardData` |
| クリップボード書き込み | `clipor/src-tauri/src/native/win32.rs` | `SetClipboardData`, `EmptyClipboard` |
| キー入力送信 (Ctrl+V) | `clipor/src-tauri/src/native/win32.rs` | `SendInput` |
| フォアグラウンドウィンドウ検出 | `clipor/src-tauri/src/native/win32.rs` | `GetForegroundWindow`, `GetWindowThreadProcessId` |
| スタートアップ登録 | `clipor/src-tauri/src/native/win32.rs` | `RegKey` (`HKCU\...\Run`) |
