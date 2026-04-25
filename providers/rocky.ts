import type { DistroProvider, DistroRelease, DistroMirror } from "./type";
import { compareVersions } from "./type";

export const ROCKY_RELEASE_URL = "https://download.rockylinux.org/pub/rocky/";

const ROCKY_MIRRORS: DistroMirror[] = [
  { name: "Rocky Official", url: "https://download.rockylinux.org/pub/rocky/", country: "US" },
  { name: "NIST Mirror", url: "https://rocky.mirror.nist.gov/pub/rocky/", country: "US" },
  { name: "CSC Finland", url: "https://mirror.neomex.org/rocky/", country: "FI" },
  { name: "Linbit", url: "https://mirror.linbit.com/pub/rocky/", country: "US" },
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

export class RockyProvider implements DistroProvider {
  name = "rocky";

  async getVersions(): Promise<string[]> {
    const releases = await this.getReleases();
    return releases.map((r) => r.version);
  }

  async getReleases(): Promise<DistroRelease[]> {
    const res = await fetch(ROCKY_RELEASE_URL);

    if (!res.ok) {
      throw new Error(`Failed to fetch Rocky Linux releases: ${res.status}`);
    }

    const html = await res.text();

    const matches = [
      ...html.matchAll(/href="(\d+\.\d+)\/"/g),
    ];

    const versions = matches
      .map((m) => m[1])
      .filter((v): v is string => typeof v === "string")
      .filter((v) => !["development", "images", "source"].includes(v));

    const uniqueVersions = [...new Set(versions)].sort((a, b) => compareVersions(b, a));

    const baseUrl = await findFastestMirror(ROCKY_MIRRORS) || "https://download.rockylinux.org/pub/rocky/";

    return uniqueVersions.map((version, index) => ({
      version,
      name: `Rocky Linux ${version}`,
      isLatest: index === 0,
      isoUrl: `${baseUrl}${version}/isos/x86_64/`,
      mirrors: ROCKY_MIRRORS,
      defaultMirror: baseUrl,
    }));
  }
}