import { platform, homedir } from "os";
import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export interface VMConfig {
  name: string;
  memory: number;
  cpus: number;
  diskSize: number;
  isoPath?: string;
  diskPath: string;
  status: "stopped" | "running" | "paused";
}

const VM_DIR = join(homedir(), ".vmx", "vms");
const VM_CONFIG_EXT = ".json";

function getPlatform(): string {
  return platform();
}

export function detectHypervisors(): string[] {
  const available: string[] = [];
  const plat = getPlatform();

  try {
    if (plat === "darwin") {
      execSync("which utmctl", { stdio: "ignore" });
      available.push("utm");
    }
  } catch {
    // UTM not installed
  }

  try {
    execSync("which qemu-system-x86_64", { stdio: "ignore" });
    available.push("qemu");
  } catch {
    // QEMU not installed
  }

  return available;
}

export function listVMs(): VMConfig[] {
  try {
    const { readdirSync, readFileSync } = require("fs");
    mkdirSync(VM_DIR, { recursive: true });
    const files = readdirSync(VM_DIR).filter((f: string) => f.endsWith(VM_CONFIG_EXT));
    return files.map((f: string) => {
      const content = readFileSync(join(VM_DIR, f), "utf-8");
      return JSON.parse(content) as VMConfig;
    });
  } catch {
    return [];
  }
}

export function createVM(name: string, isoPath?: string, memory = 2048, cpus = 2, diskSize = 20): VMConfig {
  mkdirSync(VM_DIR, { recursive: true });
  const diskPath = join(VM_DIR, `${name}.qcow2`);
  const config: VMConfig = {
    name,
    memory,
    cpus,
    diskSize,
    isoPath,
    diskPath,
    status: "stopped",
  };

  const plat = getPlatform();
  const hypervisors = detectHypervisors();

  if (plat === "darwin" && hypervisors.includes("utm")) {
    createUTMVM(config);
  } else if (hypervisors.includes("qemu")) {
    createQemuVM(config);
  } else {
    throw new Error("No supported hypervisor found. Install QEMU or UTM (macOS).");
  }

  writeFileSync(join(VM_DIR, `${name}${VM_CONFIG_EXT}`), JSON.stringify(config, null, 2));
  return config;
}

function createUTMVM(config: VMConfig): void {
  const args = [
    "create",
    "--name", config.name,
    "--memory", config.memory.toString(),
    "--cpus", config.cpus.toString(),
    "--disk", `size=${config.diskSize * 1024}`, // UTM uses MB
  ];

  if (config.isoPath) {
    args.push("--cdrom", config.isoPath);
  }

  try {
    execSync(`utmctl ${args.join(" ")}`, { stdio: "inherit" });
  } catch (e) {
    throw new Error(`Failed to create UTM VM: ${e}`);
  }
}

function createQemuVM(config: VMConfig): void {
  const diskPath = config.diskPath;
  const isoArgs = config.isoPath ? `-cdrom "${config.isoPath}" -boot d` : "";
  const plat = getPlatform();

  try {
    execSync(`qemu-img create -f qcow2 "${diskPath}" ${config.diskSize}G`, { stdio: "inherit" });

    const qemuCmd = [
      "qemu-system-x86_64",
      "-m", config.memory.toString(),
      "-smp", config.cpus.toString(),
      "-drive", `file=${diskPath},format=qcow2`,
      "-display", plat === "darwin" ? "cocoa" : "sdl",
      "-enable-kvm", plat === "linux" ? "" : "",
      isoArgs,
    ].filter(Boolean).join(" ");

    writeFileSync(join(VM_DIR, `${config.name}.sh`), `#!/bin/bash\n${qemuCmd}`, { mode: 0o755 });
  } catch (e) {
    throw new Error(`Failed to create QEMU VM: ${e}`);
  }
}

export function startVM(name: string): void {
  const vms = listVMs();
  const vm = vms.find(v => v.name === name);
  if (!vm) throw new Error(`VM ${name} not found`);

  const plat = getPlatform();
  const hypervisors = detectHypervisors();

  if (plat === "darwin" && hypervisors.includes("utm")) {
    try {
      execSync(`utmctl start "${name}"`, { stdio: "inherit" });
    } catch (e) {
      throw new Error(`Failed to start UTM VM: ${e}`);
    }
  } else if (hypervisors.includes("qemu")) {
    const scriptPath = join(VM_DIR, `${name}.sh`);
    if (!existsSync(scriptPath)) throw new Error(`VM script not found: ${scriptPath}`);
    spawn("bash", [scriptPath], { detached: true, stdio: "ignore" }).unref();
  } else {
    throw new Error("No supported hypervisor found");
  }

  vm.status = "running";
  writeFileSync(join(VM_DIR, `${name}${VM_CONFIG_EXT}`), JSON.stringify(vm, null, 2));
}

export function stopVM(name: string): void {
  const vms = listVMs();
  const vm = vms.find(v => v.name === name);
  if (!vm) throw new Error(`VM ${name} not found`);

  const plat = getPlatform();
  if (plat === "darwin") {
    try {
      execSync(`utmctl stop "${name}"`, { stdio: "inherit" });
    } catch {
      // Ignore if not running
    }
  } else {
    execSync(`pkill -f "qemu-system-x86_64.*${name}"`, { stdio: "ignore" });
  }

  vm.status = "stopped";
  writeFileSync(join(VM_DIR, `${name}${VM_CONFIG_EXT}`), JSON.stringify(vm, null, 2));
}

export function deleteVM(name: string): void {
  const vms = listVMs();
  const vm = vms.find(v => v.name === name);
  if (!vm) throw new Error(`VM ${name} not found`);

  const plat = getPlatform();
  if (plat === "darwin") {
    try {
      execSync(`utmctl delete "${name}"`, { stdio: "inherit" });
    } catch {
      // Ignore if not exists
    }
  }

  const { unlinkSync } = require("fs");
  try {
    unlinkSync(join(VM_DIR, `${name}${VM_CONFIG_EXT}`));
    if (existsSync(vm.diskPath)) unlinkSync(vm.diskPath);
    const scriptPath = join(VM_DIR, `${name}.sh`);
    if (existsSync(scriptPath)) unlinkSync(scriptPath);
  } catch (e) {
    throw new Error(`Failed to delete VM files: ${e}`);
  }
}

export function openGUI(): void {
  const plat = getPlatform();
  if (plat === "darwin") {
    try {
      execSync("open -a UTM", { stdio: "inherit" });
    } catch {
      console.log(chalk.yellow("UTM not installed. Install from https://mac.getutm.app/"));
    }
  } else if (plat === "linux") {
    console.log(chalk.yellow("Open QEMU VMs using the start command or Virt Manager"));
  }
}
