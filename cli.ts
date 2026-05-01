#!/usr/bin/env bun

import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import chalk from "chalk";
import boxen from "boxen";

import { UbuntuProvider, DebianProvider, RockyProvider, AlmaProvider, ArchProvider, FedoraProvider } from "./providers/providers.ts";
import type { DistroRelease } from "./providers/type.ts";
import { listVMs, createVM, startVM, stopVM, deleteVM, openGUI, detectHypervisors } from "./vm.ts";

const DISTROS = [
  { key: "ubuntu", name: "Ubuntu", Provider: UbuntuProvider, color: "hex(#E95420)" },
  { key: "debian", name: "Debian", Provider: DebianProvider, color: "hex(#A80030)" },
  { key: "rocky", name: "Rocky Linux", Provider: RockyProvider, color: "hex(#10B981)" },
  { key: "alma", name: "AlmaLinux", Provider: AlmaProvider, color: "hex(#0F4266)" },
  { key: "arch", name: "Arch Linux", Provider: ArchProvider, color: "hex(#1793D1)" },
  { key: "fedora", name: "Fedora", Provider: FedoraProvider, color: "hex(#3C6EB4)" },
];

function clear() {
  console.clear();
}

function logo() {
  const title = chalk.cyan.bold("  ______vmx______  ");
  const subtitle = chalk.dim("Download ISOs & Manage VMs");
  const version = chalk.dim("v2.0.0");
  
  console.log(boxen(`${title}\n${subtitle} ${version}`, {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "cyan",
  }));
}

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

async function prompt(options: string[]): Promise<number> {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      const num = parseInt(answer) || 0;
      resolve(num >= 0 && num < options.length ? num : 0);
    });
  });
}

const DOWNLOAD_DIR = join(homedir(), "iso");

async function downloadIso(url: string): Promise<void> {
  const filename = url.split("/").pop() || "download.iso";
  const filepath = join(DOWNLOAD_DIR, filename);
  
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  
  console.log(chalk.yellow("↓ Downloading..."));
  console.log(chalk.dim(`URL: ${url}`));
  console.log(chalk.cyan(`Saving to: ${filepath}`));
  console.log();
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const contentLength = response.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength) : 0;
    
    console.log(chalk.green(`Total size: ${formatSize(totalSize)}`));
    console.log();
    console.log(chalk.yellow("Press Ctrl+C to cancel") + "\n");
    
    const file = createWriteStream(filepath);
    let downloaded = 0;
    const startTime = Date.now();
    let lastUpdate = startTime;
    
    // @ts-ignore - body is iterable in Bun
    for await (const chunk of response.body) {
      file.write(chunk);
      downloaded += chunk.byteLength;
      
      const now = Date.now();
      const isLast = totalSize > 0 && downloaded >= totalSize;
      
      if (now - lastUpdate > 300 || isLast) {
        const elapsed = (now - startTime) / 1000;
        const percent = totalSize > 0 ? (downloaded / totalSize) * 100 : 0;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;
        
        let eta = "";
        if (speed > 0 && totalSize > 0) {
          const remaining = totalSize - downloaded;
          const seconds = remaining / speed;
          if (seconds < 60) eta = `${Math.round(seconds)}s`;
          else if (seconds < 3600) eta = `${Math.round(seconds / 60)}m`;
          else eta = `${Math.round(seconds / 3600)}h`;
        }
        
        const barLen = 25;
        const filled = Math.floor(barLen * percent / 100);
        const bar = chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(barLen - filled));
        
        process.stdout.write(`\r  ${bar} ${percent.toFixed(1)}%  ${formatSize(speed)}/s  ETA: ${eta}`);
        
        lastUpdate = now;
      }
    }
    
    file.end();
    console.log(chalk.green("\n\n✓ Download complete!"));
    console.log(chalk.green(`Saved: ${filepath}`));
  } catch (e) {
    console.log(chalk.red(`\n\n✗ Error: ${e}`));
  }
}

async function showMainMenu(): Promise<number> {
  clear();
  logo();
  console.log(chalk.bold("Select a distribution:") + "\n");

  for (let i = 0; i < DISTROS.length; i += 1) {
    const d = DISTROS[i];
    if (d !== undefined) console.log(`  ${chalk.cyan(`[${i + 1}]`)}  ${chalk.hex(d.color)(d.name)}`);
  }
  console.log();
  console.log(`  ${chalk.cyan(`[${DISTROS.length + 1}]`)}  ${chalk.hex("#FF6B6B")("VM Management")}`);
  console.log();
  console.log(`  ${chalk.cyan("[0]")}  ${chalk.dim("Exit")}`);
  console.log();

  return prompt([...DISTROS.map(d => d.name), "vm"]);
}

async function showReleases(distro: typeof DISTROS[0]): Promise<number> {
  const ProviderClass = distro.Provider;
  const provider = new ProviderClass();
  
  clear();
  logo();
  console.log(chalk.bold(`Loading ${distro.name}...`) + "\n");
  
  const releases = await provider.getReleases();
  const latest = releases[0];
  
  console.log(chalk.green(`Found ${releases.length} releases`));
  console.log(`  ${chalk.green("★")} Latest: ${latest?.version} (${latest?.name})`);
  console.log();
  console.log(chalk.bold("Available versions:") + "\n");
  
  const maxShow = Math.min(releases.length, 15);
  for (let i = 0; i < maxShow; i += 1) {
    const r = releases[i];
    if (r === undefined) continue;
    const marker = r.isLatest ? chalk.green("★") + " " : "  ";
    console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${marker} ${r.version} - ${r.name}`);
  }
  
  console.log();
  console.log(`  ${chalk.cyan("[0]")} ${chalk.dim("Back")}`);
  console.log();
  
  const options = ["back", ...releases.slice(0, maxShow).map(r => r.version)];
  return prompt(options);
}

async function showDownload(release: DistroRelease): Promise<number> {
  clear();
  logo();
  console.log(chalk.bold("Download") + "\n");
  console.log(`  ${chalk.cyan("Distribution:")} ${release.name}`);
  console.log(`  ${chalk.cyan("Version:")} ${release.version}`);
  console.log();
  console.log(`  ${chalk.cyan("Mirror:")} ${release.defaultMirror}`);
  console.log();
  
  if (release.mirrors?.length) {
    console.log(chalk.bold(`All mirrors (${release.mirrors.length}):`) + "\n");
    
    for (let i = 0; i < Math.min(release.mirrors.length, 5); i += 1) {
      const m = release.mirrors[i];
      if (m === undefined) continue;
      const check = m.url === release.defaultMirror ? chalk.green("✓") : " ";
      console.log(`  ${check}  ${m.name}  (${m.country || "N/A"})`);
    }
    console.log();
  }
  
  console.log(chalk.cyan("ISO URL:"));
  console.log(`  ${chalk.dim(release.isoUrl)}`);
  console.log();
  
  console.log(chalk.bold("Actions:"));
  console.log(`  ${chalk.cyan("[1]")}  Download`);
  console.log(`  ${chalk.cyan("[2]")}  Copy URL`);
  console.log(`  ${chalk.cyan("[0]")}  ${chalk.dim("Back")}`);
  console.log();
  
  return prompt(["back", "download", "copy"]);
}

async function copyUrl(url: string): Promise<void> {
  console.log(chalk.green("✓ URL copied!"));
  console.log(chalk.dim(url));
}

async function showVMMenu(): Promise<number> {
  clear();
  logo();
  console.log(chalk.bold("VM Management") + "\n");

  const hypervisors = detectHypervisors();
  if (hypervisors.length === 0) {
    console.log(chalk.yellow("No hypervisors found. Install QEMU or UTM (macOS).") + "\n");
  } else {
    console.log(chalk.green(`Available: ${hypervisors.join(", ")}`) + "\n");
  }

  const vms = listVMs();
  if (vms.length > 0) {
    console.log(chalk.bold("Your VMs:") + "\n");
    vms.forEach((vm, i) => {
      const status = vm.status === "running" ? chalk.green("●") : chalk.dim("○");
      console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${status} ${vm.name} (${vm.memory}MB, ${vm.cpus} CPU)`);
    });
    console.log();
  }

  console.log(`  ${chalk.cyan("[c]")}  Create VM`);
  console.log(`  ${chalk.cyan("[s]")}  Start VM`);
  console.log(`  ${chalk.cyan("[t]")}  Stop VM`);
  console.log(`  ${chalk.cyan("[d]")}  Delete VM`);
  console.log(`  ${chalk.cyan("[g]")}  Open GUI`);
  console.log();
  console.log(`  ${chalk.cyan("[0]")}  ${chalk.dim("Back to Main Menu")}`);
  console.log();

  return prompt(["back", "create", "start", "stop", "delete", "gui"]);
}

async function promptText(question: string): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createVMFromISO(): Promise<void> {
  clear();
  logo();
  console.log(chalk.bold("Create VM from ISO") + "\n");

  const name = await promptText("VM name: ");
  if (!name) return;

  const isoPath = await promptText("ISO path (or Enter to skip): ");
  const memory = parseInt(await promptText("Memory in MB (default 2048): ")) || 2048;
  const cpus = parseInt(await promptText("CPUs (default 2): ")) || 2;
  const diskSize = parseInt(await promptText("Disk size in GB (default 20): ")) || 20;

  try {
    const vm = createVM(name, isoPath || undefined, memory, cpus, diskSize);
    console.log(chalk.green(`\n✓ VM created: ${vm.name}`));
  } catch (e: any) {
    console.log(chalk.red(`\n✗ Error: ${e.message}`));
  }

  console.log();
  console.log(chalk.yellow("Press Enter to continue..."));
  await prompt(["continue"]);
}

async function main() {
  while (true) {
    const choice = await showMainMenu();

    if (choice === 0) {
      console.log(chalk.cyan("\nThanks for using vmx!\n"));
      process.exit(0);
    }

    if (choice === DISTROS.length + 1) {
      await handleVMMenu();
      continue;
    }

    const distro = DISTROS[choice - 1];
    if (!distro) continue;

    const versionChoice = await showReleases(distro);

    if (versionChoice === 0) continue;

    const releases = await new distro.Provider().getReleases();
    const release = releases[versionChoice - 1];

    if (!release) continue;

    const action = await showDownload(release);

    if (action === 1 && release.isoUrl) {
      await downloadIso(release.isoUrl);
    } else if (action === 2 && release.isoUrl) {
      await copyUrl(release.isoUrl);
    }

    console.log();
    console.log(chalk.yellow("Press Enter to continue..."));
    await prompt(["continue"]);
  }
}

async function handleVMMenu(): Promise<void> {
  while (true) {
    const choice = await showVMMenu();
    const option = ["back", "create", "start", "stop", "delete", "gui"][choice];

    if (option === "back") return;

    try {
      if (option === "create") {
        await createVMFromISO();
      } else if (option === "start") {
        const name = await promptText("VM name to start: ");
        if (name) { startVM(name); console.log(chalk.green(`✓ Started ${name}`)); }
      } else if (option === "stop") {
        const name = await promptText("VM name to stop: ");
        if (name) { stopVM(name); console.log(chalk.green(`✓ Stopped ${name}`)); }
      } else if (option === "delete") {
        const name = await promptText("VM name to delete: ");
        if (name) { deleteVM(name); console.log(chalk.green(`✓ Deleted ${name}`)); }
      } else if (option === "gui") {
        openGUI();
      }
    } catch (e: any) {
      console.log(chalk.red(`\n✗ Error: ${e.message}`));
    }

    if (option !== "back") {
      console.log();
      console.log(chalk.yellow("Press Enter to continue..."));
      await prompt(["continue"]);
    }
  }
}

main().catch(e => {
  console.error(chalk.red(`Error: ${e}`));
  process.exit(1);
});