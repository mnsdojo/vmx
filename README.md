# vmx

A terminal tool to download Linux ISOs and manage VMs.

## Install

### Quick Install (macOS & Linux)

```bash
curl -sL https://raw.githubusercontent.com/mnsdojo/vmx/main/install.sh | bash
```

### Manual Install

```bash
git clone https://github.com/mnsdojo/vmx.git
cd vmx
bun install
bun run cli.ts
```

## Features

### ISO Downloads
- Download ISOs for Ubuntu, Debian, Rocky Linux, AlmaLinux, Arch Linux, and Fedora
- Multiple mirror support with automatic fastest mirror detection
- Progress bar with speed and ETA
- Downloads saved to `~/iso/`

### VM Management (New in v2.0.0)
- Create and manage VMs from downloaded ISOs
- Cross-platform support (macOS with UTM/QEMU, Linux with QEMU)
- Native macOS support with UTM integration
- GUI support - Open UTM or QEMU for graphical VM management
- Start, stop, and delete VMs from the terminal

## Usage

```bash
vmx
```

Navigate the interactive menu to:
1. Download Linux ISOs
2. Manage VMs (option 7 in main menu)

## Requirements

### For ISO Downloads
- Bun runtime

### For VM Management
**macOS:**
- [UTM](https://mac.getutm.app/) (recommended) or QEMU

**Linux:**
- QEMU

## License

MIT