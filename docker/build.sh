#!/usr/bin/env bash
# Apteka 360 Desktop — Docker ichida build.
#   docker/build.sh image            # builder image'ni yig'ish (bir marta)
#   docker/build.sh icons            # assets/app-icon.png dan barcha ikonkalarni yaratish
#   docker/build.sh linux            # .deb / .rpm / .AppImage (dist/linux)
#   docker/build.sh windows          # Windows x64 NSIS EXE cross-compile (dist/windows)
#   docker/build.sh shell            # konteyner ichida shell
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="apteka360-desktop-builder:latest"
CACHE="$HERE/docker/.cache"
mkdir -p "$CACHE/cargo-registry" "$CACHE/cargo-git" "$CACHE/home" "$CACHE/target" "$HERE/dist"

# Foydalanuvchi docker guruhida bo'lsa-yu, sessiya yangilanmagan bo'lsa `sg docker` ishlatamiz
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then DOCKER="sg docker -c"; fi
run_docker() { if [ "$DOCKER" = "docker" ]; then docker "$@"; else sg docker -c "docker $(printf '%q ' "$@")"; fi; }

in_container() {
  # DOCKER_DNS=8.8.8.8 — router DNS konteyner ichida ishlamasa
  run_docker run --rm -t ${DOCKER_DNS:+--dns "$DOCKER_DNS"} \
    --user "$(id -u):$(id -g)" \
    -v "$HERE:/work" \
    -v "$CACHE/cargo-registry:/usr/local/cargo/registry" \
    -v "$CACHE/cargo-git:/usr/local/cargo/git" \
    -v "$CACHE/home:/home/builder" \
    -v "$CACHE/target:/work/target" \
    -e HOME=/home/builder \
    -e CARGO_TARGET_DIR=/work/target \
    -e XWIN_CACHE_DIR=/home/builder/.xwin \
    -e APPIMAGE_EXTRACT_AND_RUN=1 \
    -e NO_STRIP=1 \
    -e APTEKA_PANEL_URL="${APTEKA_PANEL_URL:-https://app.apteka360.uz}" \
    -e APTEKA_API_URL="${APTEKA_API_URL:-https://api.apteka360.uz}" \
    -w /work "$IMAGE" "$@"
}

case "${1:-}" in
  image)
    run_docker build -t "$IMAGE" -f "$HERE/docker/Dockerfile.builder" "$HERE/docker" ;;
  icons)
    in_container cargo tauri icon assets/app-icon.png -o src-tauri/icons ;;
  linux)
    in_container cargo tauri build --bundles "${BUNDLES:-deb,rpm,appimage}" "${@:2}"
    mkdir -p "$HERE/dist/linux"
    cp -v "$CACHE"/target/release/bundle/deb/*.deb "$CACHE"/target/release/bundle/rpm/*.rpm "$HERE/dist/linux/" 2>/dev/null || true
    cp -v "$CACHE"/target/release/bundle/appimage/*.AppImage "$HERE/dist/linux/" 2>/dev/null || true
    cp -v "$CACHE"/target/release/apteka360-desktop "$HERE/dist/linux/" ;;
  windows)
    in_container cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis "${@:2}"
    mkdir -p "$HERE/dist/windows"
    cp -v "$CACHE"/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe "$HERE/dist/windows/"
    cp -v "$CACHE"/target/x86_64-pc-windows-msvc/release/apteka360-desktop.exe "$HERE/dist/windows/" ;;
  shell)
    in_container bash ;;
  *)
    sed -n '2,8p' "$0"; exit 1 ;;
esac
