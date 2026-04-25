import { UbuntuProvider, DebianProvider, RockyProvider, AlmaProvider, ArchProvider, FedoraProvider } from "./providers/providers.ts";

const providers = [
  new UbuntuProvider(),
  new DebianProvider(),
  new RockyProvider(),
  new AlmaProvider(),
  new ArchProvider(),
  new FedoraProvider(),
];

for (const provider of providers) {
  console.log(`\n=== ${provider.name} ===`);
  try {
    const releases = await provider.getReleases();
    console.log(`Found ${releases.length} releases`);
    for (const r of releases.slice(0, 2)) {
      console.log(`  ${r.name} (latest: ${r.isLatest})`);
      if (r.isLatest && r.isoUrl) {
        console.log(`    isoUrl: ${r.isoUrl}`);
        console.log(`    defaultMirror: ${r.defaultMirror}`);
        console.log(`    mirrors: ${r.mirrors?.length || 0} available`);
      }
    }
  } catch (e) {
    console.error(`  Error: ${e}`);
  }
}