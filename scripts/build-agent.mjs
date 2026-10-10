// Package the tested SDK and a pinned, checksum-verified Node runtime, without
// depending on a Node installation or the user's global Pi configuration.
import {
  cp,
  mkdir,
  readFile,
  chmod,
  access,
  rename,
  rm,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "agent");
const bundle = join(source, "bundle");
const nodeVersion = "22.23.3";
const checksum =
  "df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de";
if (process.platform !== "linux" || process.arch !== "x64")
  throw new Error("The desktop package currently targets Linux x86_64");
await rm(bundle, { recursive: true, force: true });
await mkdir(bundle, { recursive: true });
try {
  await access(
    join(source, "node_modules/@earendil-works/pi-coding-agent/package.json"),
  );
} catch {
  execFileSync(
    "npm",
    ["ci", "--prefix", source, "--ignore-scripts", "--no-audit", "--no-fund"],
    { stdio: "inherit" },
  );
}
const archive = join(
  root,
  "artifacts/agent-build",
  `node-v${nodeVersion}-linux-x64.tar.xz`,
);
await mkdir(resolve(archive, ".."), { recursive: true });
let valid = false;
try {
  valid =
    createHash("sha256")
      .update(await readFile(archive))
      .digest("hex") === checksum;
} catch {}
if (!valid) {
  const partial = `${archive}.part`;
  try {
    await rename(archive, partial);
  } catch {}
  const download = [
    "-sfL",
    "--retry",
    "2",
    "--max-time",
    "600",
    `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.xz`,
    "-o",
    partial,
  ];
  try {
    execFileSync("curl", ["-C", "-", ...download], { stdio: "inherit" });
  } catch {
    execFileSync("curl", download, { stdio: "inherit" });
  }
  if (
    createHash("sha256")
      .update(await readFile(partial))
      .digest("hex") !== checksum
  )
    throw new Error("Node runtime archive checksum mismatch");
  await rename(partial, archive);
}
execFileSync("tar", [
  "-xf",
  archive,
  "--strip-components=1",
  "-C",
  bundle,
  `node-v${nodeVersion}-linux-x64/bin/node`,
  `node-v${nodeVersion}-linux-x64/LICENSE`,
]);
await chmod(join(bundle, "bin/node"), 0o755);
for (const name of [
  "worker.mjs",
  "session.mjs",
  "coding.mjs",
  "web.mjs",
  "mcp.mjs",
  "system-prompt.md",
  "package.json",
  "skills",
  "node_modules",
]) {
  await cp(join(source, name), join(bundle, name), { recursive: true });
}
const refs = join(bundle, "skills/tomato-files/references");
await mkdir(refs, { recursive: true });
for (const name of [
  "BACKUP_FORMAT.md",
  "PLAN_FORMAT.md",
  "NODE_DESIGN.md",
  "backup.schema.json",
  "plan.schema.json",
])
  await cp(join(root, "docs", name), join(refs, name));
console.log(
  `Agent bundle ready: Pi 1.1.0, Node ${nodeVersion}, private data excluded`,
);
