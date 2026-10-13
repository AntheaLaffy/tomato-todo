// Checksums from https://nodejs.org/dist/v22.23.3/SHASUMS256.txt.
export const nodeVersion = "22.23.3";
const runtimes = {
  "linux-x64": [
    "tar.xz",
    "df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de",
  ],
  "linux-arm64": [
    "tar.xz",
    "a44aeb94849a299b22df10b9e622ec2f605c2183501bc40590705131de7c740f",
  ],
  "darwin-x64": [
    "tar.gz",
    "8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8",
  ],
  "darwin-arm64": [
    "tar.gz",
    "23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53",
  ],
  "win32-x64": [
    "zip",
    "2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71",
  ],
  "win32-arm64": [
    "zip",
    "33dad22e4cef5ee8f9fbb1b0d037fdacd0e56d12a4580f0d63f68b894deab535",
  ],
};
const targets = {
  "x86_64-unknown-linux-gnu": "linux-x64",
  "aarch64-unknown-linux-gnu": "linux-arm64",
  "x86_64-apple-darwin": "darwin-x64",
  "aarch64-apple-darwin": "darwin-arm64",
  "x86_64-pc-windows-msvc": "win32-x64",
  "aarch64-pc-windows-msvc": "win32-arm64",
};

export function runtimeFor(
  target,
  platform = process.platform,
  arch = process.arch,
) {
  const key = target ? targets[target] : `${platform}-${arch}`;
  const runtime = runtimes[key];
  if (!runtime)
    throw new Error(
      `No bundled desktop Node runtime for ${target || `${platform}-${arch}`}`,
    );
  const [extension, checksum] = runtime;
  const windows = key.startsWith("win32-");
  const distribution = key.replace("win32-", "win-");
  const directory = `node-v${nodeVersion}-${distribution}`;
  return {
    archive: `${directory}.${extension}`,
    directory,
    checksum,
    executable: windows ? "node.exe" : "bin/node",
    windows,
  };
}
