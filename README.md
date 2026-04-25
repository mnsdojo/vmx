# vmx

A terminal tool to download Linux ISOs easily.

## Install

```bash
curl -sL https://raw.githubusercontent.com/mnsdojo/vmx/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/mnsdojo/vmx.git
cd vmx
bun install
bun run cli.ts
```

## Features

- Download ISOs for Ubuntu, Debian, Rocky Linux, AlmaLinux, Arch Linux, and Fedora
- Multiple mirror support
- Progress bar with speed and ETA
- Downloads saved to `~/iso/`

## Usage

```bash
vmx
```

## License

MIT