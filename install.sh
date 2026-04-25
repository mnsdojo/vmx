#!/bin/bash

set -e

REPO="mnsdojo/vmx"
VMX_DIR="$HOME/.vmx"
VMX_BIN="$VMX_DIR/vmx"

install_vmx() {
    mkdir -p "$VMX_DIR"
    
    echo "Downloading vmx..."
    LATEST=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep -o '"tag_name"' | cut -d'"' -f4)
    curl -sL "https://github.com/$REPO/releases/download/$LATEST/vmx-linux-x64" -o "$VMX_BIN"
    
    chmod +x "$VMX_BIN"
    
    echo "Adding to PATH..."
    SHELL_RC="$HOME/.zshrc"
    if [ -n "$BASH_VERSION" ]; then
        SHELL_RC="$HOME/.bashrc"
    fi
    
    if ! grep -q "$VMX_DIR" "$SHELL_RC" 2>/dev/null; then
        echo "export PATH=\"\$PATH:$VMX_DIR\"" >> "$SHELL_RC"
        echo "Added to $SHELL_RC"
    fi
    
    echo "Done! Run 'source $SHELL_RC' or start a new shell, then run 'vmx'"
}

install_vmx