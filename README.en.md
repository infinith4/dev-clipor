# Clipor

[日本語](README.md) | [English](README.en.md)

![C0 (statements)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/infinith4/dev-clipor/gh-pages-badges/c0-coverage.json)
![C1 (branches)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/infinith4/dev-clipor/gh-pages-badges/c1-coverage.json)
![C2 (functions)](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/infinith4/dev-clipor/gh-pages-badges/c2-coverage.json)

A clipboard manager application for Windows. It supports clipboard history, reusable templates, and secure operation with password protection.

## Installation

<table>
  <tr>
    <td align="center" width="33%">
      <b>Microsoft Store</b><br><br>
      <a href="https://apps.microsoft.com/detail/cd388dc7-a590-4a5a-b473-cc619446722f">
        <img src="https://developer.microsoft.com/store/badges/images/English_get-it-from-MS.png" alt="Get it from Microsoft" width="180">
      </a>
    </td>
    <td align="center" width="33%">
      <b>MSI Installer</b><br><br>
      <a href="https://github.com/infinith4/dev-clipor/releases/latest">
        <img src="https://img.shields.io/badge/MSI-Download-0078D4?style=for-the-badge&logo=windows" alt="Download MSI">
      </a><br><br>
      <sub>Windows Installer (recommended)</sub>
    </td>
    <td align="center" width="33%">
      <b>NSIS Setup</b><br><br>
      <a href="https://github.com/infinith4/dev-clipor/releases/latest">
        <img src="https://img.shields.io/badge/NSIS-Download-0078D4?style=for-the-badge&logo=windows" alt="Download NSIS">
      </a><br><br>
      <sub>Setup executable</sub>
    </td>
  </tr>
</table>

## Key Features

- **Clipboard History** - Automatically records copied content with search and filtering
- **Pinning** - Keep frequently used entries pinned for quick access
- **Templates** - Save and manage frequently used text as templates, with import/export support
- **Text Transformations** - Full-width/half-width conversion, whitespace trimming, and other text cleanup
- **Password Protection** - Protect clipboard history with AES-256-GCM encryption
- **Hover Preview** - Show full content in a tooltip when hovering over an item
- **Global Hotkey** - Open the popup instantly with `Ctrl+Alt+Z` (customizable)
- **Launch on Startup** - Optionally start automatically with Windows

## Tech Stack

| Layer | Technology |
|------|------|
| Frontend | React 19.2 + TypeScript 6.0 + Vite 8.0 |
| Backend | Rust + Tauri 2.10 |
| Database | SQLite (rusqlite 0.39, bundled) |
| Encryption | AES-256-GCM + PBKDF2 |
| Testing | Vitest 4.1 + Testing Library 16.3 |

## Requirements

- **Node.js** 24 or later
- **Rust** (stable toolchain)
- **Windows** (uses `clipboard-win` and Windows APIs)

## Usage

1. Run the installer (`MSI` or `NSIS`) and install the app.
2. After launch, the app icon appears in the system tray.
3. Press `Ctrl+Alt+Z` to open the clipboard history popup.
4. The popup has three tabs:
   - **History** - View copied text, search, pin, and delete entries
   - **Templates** - Register and reuse frequently used text
   - **Settings** - Configure history retention, startup behavior, password protection, and more

## Build

<details>
<summary>Show build instructions</summary>

### Development Mode

```bash
cd clipor
npm install
npm run tauri dev
```

### Run Tests

```bash
cd clipor
npm test
```

### Production Build

```bash
cd clipor
npm ci
npm test
npm run tauri build
```

Build artifacts are generated under `clipor/src-tauri/target/release/`:

- `clipor.exe` - Standalone executable
- `bundle/msi/*.msi` - MSI installers
- `bundle/nsis/*.exe` - NSIS setup executables

### CI/CD

GitHub Actions is configured for build and release automation. When a tag in the `v*` format is pushed, a Windows build runs and the installers are published to GitHub Releases.

</details>

## Data Storage

- **Clipboard history**: `%LOCALAPPDATA%\Clipor\history.db` (SQLite)
- **Settings file**: `%LOCALAPPDATA%\Clipor\settings.json`

## Project Structure

```
clipor/
├── src/                    # React frontend
│   ├── App.tsx
│   ├── components/         # UI components
│   ├── hooks/              # Custom hooks
│   ├── types/              # Type definitions
│   └── styles/             # CSS
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # App initialization
│   │   ├── commands/       # Tauri commands
│   │   ├── models/         # Data models
│   │   ├── services/       # Business logic
│   │   └── native/         # Windows API integration
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

## Security Notes

- Clipboard history is stored in SQLite **without encryption by default**. Sensitive data such as passwords or API keys may remain in history. Enabling password protection applies AES-256-GCM encryption.
- The app does not perform any external network communication. All data is stored and processed locally.
- The only Windows Registry write is for startup configuration under `HKEY_CURRENT_USER`.

## License

MIT
