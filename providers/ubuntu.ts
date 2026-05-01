
import { compareVersions, type DistroProvider, type DistroRelease, type DistroMirror } from "./type";


export const UBUNTU_RELEASE_URL = "https://releases.ubuntu.com/";

const UBUNTU_MIRRORS: DistroMirror[] = [
  { name: "Ubuntu Official", url: "https://releases.ubuntu.com/", country: "US" },
  { name: "UK Mirror", url: "https://uk.releases.ubuntu.com/", country: "GB" },
  { name: "NL Mirror", url: "https://nl.releases.ubuntu.com/", country: "NL" },
  { name: "DE Mirror", url: "https://de.releases.ubuntu.com/", country: "DE" },
  { name: "FR Mirror", url: "https://fr.releases.ubuntu.com/", country: "FR" },
  { name: "AU Mirror", url: "https://au.releases.ubuntu.com/", country: "AU" },
  { name: "JP Mirror", url: "https://jp.releases.ubuntu.com/", country: "JP" },
  { name: "SG Mirror", url: "https://sg.releases.ubuntu.com/", country: "SG" },
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


export class UbuntuProvider implements DistroProvider {
  name: string = "ubuntu";

  async getVersions(): Promise<string[]> {
    const releases = await this.getReleases();
    return releases.map((r) => r.version);
  }

  async getReleases(): Promise<DistroRelease[]> {
    const res = await fetch(UBUNTU_RELEASE_URL);

    if (!res.ok) {
      throw new Error(`Failed to fetch Ubuntu releases: ${res.status}`);
    }

    const html = await res.text();

    const matches = [
      ...html.matchAll(/href="(\d{2}\.\d{2}(?:\.\d+)?)\/"/g),
    ];

    const versions = matches
      .map((m) => m[1])
      .filter((v): v is string => typeof v === "string");

    const uniqueVersions = [...new Set(versions)].sort((a, b) => compareVersions(b, a));

    const baseUrl = await findFastestMirror(UBUNTU_MIRRORS) || "https://releases.ubuntu.com/";

    return uniqueVersions.map((version, index) => ({
      version,
      name: `Ubuntu ${version}`,
      isLatest: index === 0,
      isoUrl: `${baseUrl}${version}/ubuntu-${version}-desktop-amd64.iso`,
      isoType: 'desktop' as const,
      isos: [
        {
          version: `${version}-desktop`,
          isoUrl: `${baseUrl}${version}/ubuntu-${version}-desktop-amd64.iso`,
          isoSize: 'Desktop ISO',
        },
        {
          version: `${version}-server`,
          isoUrl: `${baseUrl}${version}/ubuntu-${version}-live-server-amd64.iso`,
          isoSize: 'Server ISO',
        },
      ],
      mirrors: UBUNTU_MIRRORS,
      defaultMirror: baseUrl,
    }));
  }
}