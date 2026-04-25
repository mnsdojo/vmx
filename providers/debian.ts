import type { DistroProvider, DistroRelease, DistroMirror } from "./type";
import { compareVersions } from "./type";

export const DEBIAN_ARCHIVE_URL = "https://cdimage.debian.org/cdimage/archive/";

const DEBIAN_MIRRORS: DistroMirror[] = [
  { name: "Debian Official", url: "https://cdimage.debian.org/cdimage/archive/", country: "US" },
  { name: "Kernel.org Mirror", url: "https://mirrors.kernel.org/debian-cd/archive/", country: "US" },
  { name: "OCF Berkeley", url: "https://mirrors.ocf.berkeley.edu/debian-cd/archive/", country: "US" },
  { name: "MIT Mirror", url: "https://mirrors.mit.edu/debian-cd/", country: "US" },
  { name: "Sonic.net", url: "https://mirrors.sonic.net/debian-cd/", country: "US" },
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

export class DebianProvider implements DistroProvider {
  name = "debian";

  async getVersions(): Promise<string[]> {
    const releases = await this.getReleases();
    return releases.map((r) => r.version);
  }

  async getReleases(): Promise<DistroRelease[]> {
    const allReleases: DistroRelease[] = [];
    const seen = new Set<string>();

    const res = await fetch(DEBIAN_ARCHIVE_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch Debian releases: ${res.status}`);
    }

    const html = await res.text();

    const dirMatches = [...html.matchAll(/href="(\d+\.\d+(?:\.\d+)?)\/"/g)];
    for (const m of dirMatches) {
      const version = m[1];
      if (version && !seen.has(version) && !version.includes("_")) {
        seen.add(version);
        allReleases.push({
          version,
          name: `Debian ${version}`,
          isLatest: false,
          mirrors: DEBIAN_MIRRORS,
        });
      }
    }

    const sorted = allReleases.sort((a, b) => compareVersions(b.version, a.version));
    if (sorted.length > 0 && sorted[0]) sorted[0].isLatest = true;

    const baseUrl = await findFastestMirror(DEBIAN_MIRRORS) || "https://cdimage.debian.org/cdimage/archive/";

    return sorted.map((r) => ({
      ...r,
      isoUrl: `${baseUrl}${r.version}/amd64/iso-dvd/`,
      defaultMirror: baseUrl,
    }));
  }
}
