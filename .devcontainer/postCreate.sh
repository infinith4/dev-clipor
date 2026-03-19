#!/usr/bin/env bash
set -euo pipefail

# ── Global CLI tools ──
npm config set prefix "$HOME/.npm-global"
npm install -g eslint prettier @tauri-apps/cli
pip install --user ruff black

# ── Frontend deps ──
cd /workspaces/dev-clipor/clipor
npm install

# ── Pre-fetch Rust dependencies ──
cd /workspaces/dev-clipor/clipor/src-tauri
cargo fetch
cargo fetch --target x86_64-pc-windows-gnu

# ── PATH ──
{
  echo 'export PATH="$PATH:$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/bin"'
  echo 'export TRC_TIMEZONE=Asia/Tokyo'
} >> "$HOME/.bashrc"

echo ""
echo "=== dev-clipor devcontainer ready ==="
echo "  Frontend:  cd clipor && npm run build / npm test"
echo "  Rust check (Linux):   cd clipor/src-tauri && cargo check"
echo "  Rust check (Windows): cd clipor/src-tauri && cargo check --target x86_64-pc-windows-gnu"
echo "  Rust test:            cd clipor/src-tauri && cargo test"
echo "  Cross build (exe):    cd clipor/src-tauri && cargo build --target x86_64-pc-windows-gnu --release"
echo ""
