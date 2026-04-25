const urls = [
  "https://releases.ubuntu.com/26.04/ubuntu-26.04-live-server-amd64.iso",
  "https://cdimage.debian.org/cdimage/archive/13.3.0/amd64/iso-dvd/",
  "https://download.rockylinux.org/pub/rocky/10.1/isos/x86_64/",
  "https://repo.almalinux.org/almalinux/10.1/isos/x86_64/",
  "https://mirrors.edge.kernel.org/archlinux/iso/2026.04.01/archlinux-2026.04.01-x86_64.iso",
  "https://mirrors.kernel.org/fedora/releases/43/Everything/x86_64/iso/",
];

for (const url of urls) {
  const res = await fetch(url, { method: "HEAD" });
  console.log(url.split("/").slice(0, 5).join("/") + "... " + res.status);
}