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
import { resolve, join, dirname } from "node:path";
import { nodeVersion, runtimeFor } from "./agent-runtime.mjs";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "agent");
const bundle = join(source, "bundle");
const args = process.argv.slice(2);
if (
  args.length > 1 ||
  (args.length && (!args[0].startsWith("--target=") || args[0] === "--target="))
)
  throw new Error(
    "Usage: node scripts/build-agent.mjs [--target=<Rust target triple>]",
  );
const runtime = runtimeFor(args[0]?.slice("--target=".length));
await rm(bundle, { recursive: true, force: true });
await mkdir(bundle, { recursive: true });
try {
  await access(
    join(source, "node_modules/@earendil-works/pi-coding-agent/package.json"),
  );
} catch {
  const npmArgs = [
    "ci",
    "--prefix",
    source,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ];
  // npm.cmd requires a shell. Invoke npm's JS entry instead so paths remain arguments.
  if (process.platform === "win32") {
    execFileSync(
      process.execPath,
      [
        join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
        ...npmArgs,
      ],
      { stdio: "inherit" },
    );
  } else {
    execFileSync("npm", npmArgs, { stdio: "inherit" });
  }
}
const archive = join(root, "artifacts/agent-build", runtime.archive);
await mkdir(resolve(archive, ".."), { recursive: true });
let valid = false;
try {
  valid =
    createHash("sha256")
      .update(await readFile(archive))
      .digest("hex") === runtime.checksum;
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
    `https://nodejs.org/dist/v${nodeVersion}/${runtime.archive}`,
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
      .digest("hex") !== runtime.checksum
  )
    throw new Error("Node runtime archive checksum mismatch");
  await rename(partial, archive);
}
if (runtime.windows) {
  // Windows ships bsdtar; Linux cross-packaging can use unzip for the ZIP archive.
  const staging = join(root, "artifacts/agent-build", runtime.directory);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  if (process.platform === "linux") {
    execFileSync("unzip", ["-q", archive, "-d", staging]);
  } else {
    execFileSync("tar", ["-xf", archive, "-C", staging]);
  }
  await mkdir(join(bundle, "bin"), { recursive: true });
  await cp(
    join(staging, runtime.directory, runtime.executable),
    join(bundle, "bin/node.exe"),
  );
  await cp(
    join(staging, runtime.directory, "LICENSE"),
    join(bundle, "LICENSE"),
  );
  await rm(staging, { recursive: true, force: true });
} else {
  execFileSync("tar", [
    "-xf",
    archive,
    "--strip-components=1",
    "-C",
    bundle,
    `${runtime.directory}/bin/node`,
    `${runtime.directory}/LICENSE`,
  ]);
  await chmod(join(bundle, "bin/node"), 0o755);
}
for (const name of [
  "worker.mjs",
  "codex-config.mjs",
  "mcp-config.mjs",
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
// npm writes .bin shims whose targets are absolute build-machine paths, so they
// dangle wherever the bundle is unpacked. Nothing at runtime invokes them -- the
// Rust side spawns bundle/bin/node with explicit script paths and the coding
// sandbox PATH never includes .bin -- so drop the directory entirely.
await rm(join(bundle, "node_modules/.bin"), { recursive: true, force: true });
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
  `Agent bundle ready: Pi 1.1.0, Node ${nodeVersion} (${runtime.directory}), private data excluded`,
);
