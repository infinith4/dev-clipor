# Clipor

## Security Notice

- Clipboard history is stored **unencrypted** in a local SQLite database (`%LOCALAPPDATA%\Clipor\history.db`). Sensitive data such as passwords or API keys copied to the clipboard may be persisted in the history.
- This application does not make any external network communications. All data is stored and processed locally.
- Windows registry writes occur only for the "launch on startup" setting, limited to `HKEY_CURRENT_USER`.
