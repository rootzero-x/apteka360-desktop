# Apteka 360 Desktop — Linux build + Windows cross-compile muhiti (Docker)
# Ishlatish: docker/build.sh (README ga qarang)
FROM rust:1-trixie

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev \
      libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev \
      libssl-dev pkg-config build-essential curl wget file ca-certificates \
      xdg-utils patchelf desktop-file-utils \
      nsis lld llvm clang \
      xvfb imagemagick x11-utils dbus-x11 \
      libwebkit2gtk-4.1-0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Windows x64 (MSVC) target + cargo-xwin (Linux'da MSVC cross-compile)
RUN rustup target add x86_64-pc-windows-msvc \
 && cargo install cargo-xwin --version 0.23.1 --locked

# Tauri CLI (tayyor binar)
ARG TAURI_CLI_VERSION=2.12.3
RUN curl -fsSL -o /tmp/cargo-tauri.tgz \
      https://github.com/tauri-apps/tauri/releases/download/tauri-cli-v${TAURI_CLI_VERSION}/cargo-tauri-x86_64-unknown-linux-gnu.tgz \
 && tar -xzf /tmp/cargo-tauri.tgz -C /usr/local/cargo/bin && rm /tmp/cargo-tauri.tgz \
 && chmod +x /usr/local/cargo/bin/cargo-tauri && cargo tauri --version

# Har qanday UID bilan ishlashi uchun
RUN chmod -R a+w /usr/local/cargo /usr/local/rustup && mkdir -p /work /home/builder && chmod 777 /home/builder
ENV HOME=/home/builder CARGO_TARGET_DIR=/work/target XWIN_CACHE_DIR=/home/builder/.xwin
WORKDIR /work
