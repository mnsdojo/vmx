#!/usr/bin/env bun

import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import chalk from "chalk";
import boxen from "boxen";

import { UbuntuProvider, DebianProvider, RockyProvider, AlmaProvider, ArchProvider, FedoraProvider } from "./providers/providers.ts";
import type { DistroRelease } from "./providers/type.ts";

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
  const subtitle = chalk.dim("Download Linux ISOs easily");
  const version = chalk.dim("v1.0.0");
  
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
  console.log(`  ${chalk.cyan("[0]")}  ${chalk.dim("Exit")}`);
  console.log();
  
  return prompt(DISTROS.map(d => d.name));
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

async function main() {
  while (true) {
    const choice = await showMainMenu();
    
    if (choice === 0) {
      console.log(chalk.cyan("\nThanks for using vmx!\n"));
      process.exit(0);
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

main().catch(e => {
  console.error(chalk.red(`Error: ${e}`));
  process.exit(1);
});