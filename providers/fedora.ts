import type { DistroProvider, DistroRelease, DistroMirror } from "./type";

export const FEDORA_RELEASE_URL = "https://mirrors.kernel.org/fedora/releases/";

const FEDORA_MIRRORS: DistroMirror[] = [
  { name: "Kernel.org", url: "https://mirrors.kernel.org/fedora/releases/", country: "US" },
  { name: "MIT Mirror", url: "https://mirrors.mit.edu/fedora/linux/releases/", country: "US" },
  { name: "OCF Berkeley", url: "https://mirrors.ocf.berkeley.edu/fedora/releases/", country: "US" },
  { name: "Stanford", url: "https://mirrors.stanford.edu/fedora/releases/", country: "US" },
  { name: "Tennessee", url: "https://mirrors.utdn.com/fedora/releases/", country: "US" },
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

export class FedoraProvider implements DistroProvider {
  name = "fedora";

  async getVersions(): Promise<string[]> {
    const releases = await this.getReleases();
    return releases.map((r) => r.version);
  }

  async getReleases(): Promise<DistroRelease[]> {
    const res = await fetch(FEDORA_RELEASE_URL);

    if (!res.ok) {
      throw new Error(`Failed to fetch Fedora releases: ${res.status}`);
    }

    const html = await res.text();

    const matches = [...html.matchAll(/href="(\d+)\/"/g)];

    const versions = matches
      .map((m) => m[1])
      .filter((v): v is string => typeof v === "string")
      .filter((v) => !isNaN(parseInt(v)) && parseInt(v) >= 10);

    const uniqueVersions = [...new Set(versions)].sort((a, b) => parseInt(b) - parseInt(a));

    const baseUrl = await findFastestMirror(FEDORA_MIRRORS) || "https://mirrors.kernel.org/fedora/releases/";

    return uniqueVersions.map((version, index) => ({
      version,
      name: `Fedora ${version}`,
      isLatest: index === 0,
      isoUrl: `${baseUrl}${version}/Workstation/x86_64/iso/Fedora-Workstation-Live-x86_64-${version}-1.2.iso`,
      isoType: 'desktop' as const,
      isos: [
        {
          version: `${version}-workstation`,
          isoUrl: `${baseUrl}${version}/Workstation/x86_64/iso/Fedora-Workstation-Live-x86_64-${version}-1.2.iso`,
          isoSize: 'Workstation (GNOME)',
        },
        {
          version: `${version}-server`,
          isoUrl: `${baseUrl}${version}/Server/x86_64/iso/Fedora-Server-dvd-x86_64-${version}-1.2.iso`,
          isoSize: 'Server',
        },
        {
          version: `${version}-kde`,
          isoUrl: `${baseUrl}${version}/Spins/x86_64/iso/Fedora-KDE-Live-x86_64-${version}-1.2.iso`,
          isoSize: 'KDE Spin',
        },
      ],
      mirrors: FEDORA_MIRRORS,
      defaultMirror: baseUrl,
    }));
  }
}