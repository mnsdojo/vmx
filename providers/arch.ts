import type { DistroProvider, DistroRelease, DistroMirror } from "./type";

export const ARCH_ISO_URL = "https://mirrors.edge.kernel.org/archlinux/iso/latest/";

const ARCH_MIRRORS: DistroMirror[] = [
  { name: "Edge Kernel", url: "https://mirrors.edge.kernel.org/archlinux/", country: "US" },
  { name: "Kernel.org", url: "https://mirrors.kernel.org/pub/archlinux/", country: "US" },
  { name: "MIT Mirror", url: "https://mirrors.mit.edu/archlinux/", country: "US" },
  { name: "OCF Berkeley", url: "https://mirrors.ocf.berkeley.edu/archlinux/", country: "US" },
  { name: "Vanderbilt", url: "https://mirror.vanderbilt.edu/archlinux/", country: "US" },
];

async function findFastestMirror(mirrors: DistroMirror[]): Promise<string | null> {
  for (const mirror of mirrors) {
    try {
      const res = await fetch(mirror.url, { method: "HEAD" });
      if (res.ok) return mirror.url;
    } catch {}
  }
  return null;
}

export class ArchProvider implements DistroProvider {
  name = "arch";

  async getVersions(): Promise<string[]> {
    const releases = await this.getReleases();
    return releases.map((r) => r.version);
  }

  async getReleases(): Promise<DistroRelease[]> {
    const res = await fetch(ARCH_ISO_URL);

    if (!res.ok) {
      throw new Error(`Failed to fetch Arch Linux releases: ${res.status}`);
    }

    const html = await res.text();

    const matches = [
      ...html.matchAll(/archlinux-(\d{4}\.\d{2}\.\d{2})-x86_64\.iso/g),
    ];

    const versions = matches
      .map((m) => m[1])
      .filter((v): v is string => typeof v === "string");

    const uniqueVersions = [...new Set(versions)].sort().reverse();

    const baseUrl = await findFastestMirror(ARCH_MIRRORS) || "https://mirrors.edge.kernel.org/archlinux/";

    return uniqueVersions.map((version, index) => ({
      version,
      name: `Arch Linux ${version}`,
      isLatest: index === 0,
      isoUrl: `${baseUrl}iso/${version}/archlinux-${version}-x86_64.iso`,
      isoType: 'minimal' as const,
      isos: [
        {
          version: `${version}-base`,
          isoUrl: `${baseUrl}iso/${version}/archlinux-${version}-x86_64.iso`,
          isoSize: 'Base (CLI install)',
        },
        {
          version: `${version}-archinstall`,
          isoUrl: `${baseUrl}iso/${version}/archlinux-${version}-x86_64.iso`,
          isoSize: 'With archinstall (guided)',
        },
      ],
      mirrors: ARCH_MIRRORS,
      defaultMirror: baseUrl,
    }));
  }
}