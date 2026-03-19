#!/usr/bin/env bash
set -euo pipefail

npm config set prefix "$HOME/.npm-global"
npm install -g eslint prettier @openai/codex
pip install --user ruff black

mkdir -p "$HOME/bin"


echo 'export PATH="$PATH:$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/.dotnet/tools:$HOME/bin"' >>"$HOME/.bashrc"
echo 'export TRC_TIMEZONE=Asia/Tokyo' >>"$HOME/.bashrc"
echo 'export CLI_TRACKER_DB_PATH=/workspaces/dev-clipboard/data.db' >>"$HOME/.bashrc"
echo 'export TRC_UI_INTERVAL=10' >>"$HOME/.bashrc"
