import type { DistroProvider, DistroRelease, DistroMirror } from "./type";
import { compareVersions } from "./type";

export const ALMA_RELEASE_URL = "https://repo.almalinux.org/almalinux/";

const ALMA_MIRRORS: DistroMirror[] = [
  { name: "AlmaLinux Official", url: "https://repo.almalinux.org/almalinux/", country: "US" },
  { name: "AWS US-East", url: "https://bos.aws.repo.almalinux.org/almalinux/", country: "US" },
  { name: "AWS US-West", url: "https://for.aws.repo.almalinux.org/almalinux/", country: "US" },
  { name: "AWS EU", url: "https://eu-central.repo.almalinux.org/almalinux/", country: "DE" },
  { name: "AWS Asia", url: "https://blr.aws.repo.almalinux.org/almalinux/", country: "IN" },
  { name: "AWS AU", url: "https://syd.aws.repo.almalinux.org/almalinux/", country: "AU" },
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

export class AlmaProvider implements DistroProvider {
  name = "alma";

  async getVersions(): Promise<string[]> {
    const releases = await this.getReleases();
    return releases.map((r) => r.version);
  }

  async getReleases(): Promise<DistroRelease[]> {
    const res = await fetch(ALMA_RELEASE_URL);

    if (!res.ok) {
      throw new Error(`Failed to fetch AlmaLinux releases: ${res.status}`);
    }

    const html = await res.text();

    const matches = [
      ...html.matchAll(/href="(\d+\.\d+)\/"/g),
    ];

    const versions = matches
      .map((m) => m[1])
      .filter((v): v is string => typeof v === "string");

    const uniqueVersions = [...new Set(versions)].sort((a, b) => compareVersions(b, a));

    const baseUrl = await findFastestMirror(ALMA_MIRRORS) || "https://repo.almalinux.org/almalinux/";

    return uniqueVersions.map((version, index) => ({
      version,
      name: `AlmaLinux ${version}`,
      isLatest: index === 0,
      isoUrl: `${baseUrl}${version}/isos/x86_64/`,
      mirrors: ALMA_MIRRORS,
      defaultMirror: baseUrl,
    }));
  }
}