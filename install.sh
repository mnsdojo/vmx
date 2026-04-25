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
    local url="https://github.com/$REPO/releases/download/$tag/vmx-linux-x64"

    log "Downloading vmx $tag from $url..."
    curl -sL --fail "$url" -o "$VMX_BIN" \
        || error "Download failed. Check that release asset 'vmx-linux-x64' exists for tag $tag."

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

    local tag
    tag=$(get_latest_tag)

    download_vmx "$tag"
    add_to_path

    log "Installation complete! Run 'vmx' in a new shell to get started."
}

install_vmx