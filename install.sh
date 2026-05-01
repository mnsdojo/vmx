#!/bin/bash

set -euo pipefail

REPO="mnsdojo/vmx"
VMX_DIR="$HOME/.vmx"
VMX_BIN="$VMX_DIR/vmx"

log()   { echo "[vmx] $*"; }
error() { echo "[vmx] ERROR: $*" >&2; exit 1; }

check_dependencies() {
    for cmd in curl grep sed chmod mkdir; do
        command -v "$cmd" &>/dev/null || error "Required command not found: $cmd"
    done
}

detect_platform() {
    local os arch
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)

    case "$os" in
        linux)
            platform="linux"
            ;;
        darwin)
            platform="darwin"
            ;;
        *)
            error "Unsupported operating system: $os"
            ;;
    esac

    case "$arch" in
        x86_64|amd64)
            arch="x64"
            ;;
        aarch64|arm64)
            arch="arm64"
            ;;
        *)
            error "Unsupported architecture: $arch"
            ;;
    esac

    echo "${platform}-${arch}"
}

get_latest_tag() {
    local response
    response=$(curl -sL --fail "https://api.github.com/repos/$REPO/releases/latest") \
        || error "Failed to reach GitHub API. Check your internet connection."

    local tag
    tag=$(echo "$response" | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')

    [ -z "$tag" ] && error "Could not parse latest release tag. The repo may have no releases."
    echo "$tag"
}

download_vmx() {
    local tag="$1"
    local platform_arch="$2"
    local url="https://github.com/$REPO/releases/download/$tag/vmx-${platform_arch}"

    log "Detected platform: $platform_arch"
    log "Downloading vmx $tag from $url..."
    curl -sL --fail "$url" -o "$VMX_BIN" \
        || error "Download failed. Check that release asset 'vmx-${platform_arch}' exists for tag $tag."

    chmod +x "$VMX_BIN"
    log "Binary installed to $VMX_BIN"
}

detect_shell_rc() {
    local shell_name
    shell_name=$(basename "$SHELL")

    case "$shell_name" in
        zsh)  echo "$HOME/.zshrc" ;;
        bash) echo "$HOME/.bashrc" ;;
        fish) echo "$HOME/.config/fish/config.fish" ;;
        *)    echo "$HOME/.bashrc" ;;  # safe fallback
    esac
}

add_to_path() {
    local shell_rc
    shell_rc=$(detect_shell_rc)

    if grep -q "$VMX_DIR" "$shell_rc" 2>/dev/null; then
        log "PATH already contains $VMX_DIR in $shell_rc, skipping."
        return
    fi

    # fish uses a different syntax
    if [[ "$shell_rc" == *fish* ]]; then
        echo "fish_add_path $VMX_DIR" >> "$shell_rc"
    else
        echo "export PATH=\"\$PATH:$VMX_DIR\"" >> "$shell_rc"
    fi

    log "Added $VMX_DIR to PATH in $shell_rc"
    log "Run: source $shell_rc  (or open a new shell)"
}

install_vmx() {
    log "Starting installation..."

    check_dependencies

    mkdir -p "$VMX_DIR" || error "Failed to create directory $VMX_DIR"

    local tag platform_arch
    tag=$(get_latest_tag)
    platform_arch=$(detect_platform)

    download_vmx "$tag" "$platform_arch"
    add_to_path

    log "Installation complete! Run 'vmx' in a new shell to get started."
}

install_vmx