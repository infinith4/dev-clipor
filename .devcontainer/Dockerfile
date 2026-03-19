FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    file \
    pkg-config \
    wget \
    # Tauri v2 Linux system deps
    libwebkit2gtk-4.1-dev \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    # Cross-compilation to Windows (optional)
    gcc-mingw-w64-x86-64 \
    && rm -rf /var/lib/apt/lists/*
