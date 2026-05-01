

export interface DistroIso {
  version: string;
  isoUrl: string;
  isoSize?: string;
  checksum?: string;
}

export interface DistroMirror {
  name: string;
  url: string;
  country?: string;
  region?: string;
}

export interface DistroRelease {
  version: string;
  name: string;
  releaseDate?: string;
  isLatest: boolean;
  isoUrl?: string;
  isoType?: 'desktop' | 'server' | 'minimal' | 'dvd';
  isos?: DistroIso[];
  mirrors?: DistroMirror[];
  defaultMirror?: string;
  isoSize?: string;
  checksum?: string;
  checksumType?: string;
}

export interface DistroProvider {
  name: string;
  getVersions(): Promise<string[]>;
  getReleases(): Promise<DistroRelease[]>;
}
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}