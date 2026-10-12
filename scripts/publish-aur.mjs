#!/usr/bin/env node
// Render and publish the AUR -bin package for one release.
//
// The archive hash is computed here, from the actual release file, and written
// into the generated PKGBUILD. It cannot live in the repository: every release
// produces a different tarball, so a pinned hash would be wrong the moment the
// version changes. packaging/aur/PKGBUILD.in is the source of truth; the copy
// in the AUR repository is generated output.
//
//   node scripts/publish-aur.mjs                 # current package.json version
//   node scripts/publish-aur.mjs --version 0.8.2
//   node scripts/publish-aur.mjs --tarball /path/to/tomato-todo-0.8.2-x86_64-linux.tar.gz
//   node scripts/publish-aur.mjs --push          # commit and push to AUR
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkgname = "tomato-todo-bin";
const repo = "AntheaLaffy/tomato-todo";
const remote = `ssh://aur@aur.archlinux.org/${pkgname}.git`;
const template = join(root, "packaging/aur/PKGBUILD.in");
const desktop = join(root, "packaging/aur/tomato-todo.desktop");
const license = join(root, "LICENSE");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, fallback) => {
  const at = argv.indexOf(name);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const version = option(
  "--version",
  JSON.parse(await readFile(join(root, "package.json"), "utf8")).version,
);
const push = flag("--push");
const work = resolve(option("--work", join(root, "artifacts/aur", pkgname)));
const tarball = join(work, `tomato-todo-${version}-x86_64-linux.tar.gz`);
const local = option("--tarball", null);

const sha256 = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

async function fetchTarball() {
  if (local) {
    await copyFile(resolve(local), tarball);
    return;
  }
  if (await exists(tarball)) {
    console.log(`Reusing ${tarball}`);
    return;
  }
  const url = `https://github.com/${repo}/releases/download/v${version}/tomato-todo-${version}-x86_64-linux.tar.gz`;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tarball));
}

await mkdir(work, { recursive: true });
await fetchTarball();
const sums = {
  tarball: await sha256(tarball),
  desktop: await sha256(desktop),
  license: await sha256(license),
};
console.log(`tarball sha256 ${sums.tarball}`);

const pkgbuild = (await readFile(template, "utf8"))
  .replaceAll("@PKGVER@", version)
  .replaceAll("@SHA256_TARBALL@", sums.tarball)
  .replaceAll("@SHA256_DESKTOP@", sums.desktop)
  .replaceAll("@SHA256_LICENSE@", sums.license);
await writeFile(join(work, "PKGBUILD"), pkgbuild);
await copyFile(desktop, join(work, "tomato-todo.desktop"));
await copyFile(license, join(work, "LICENSE"));
await writeFile(
  join(work, ".SRCINFO"),
  execFileSync("makepkg", ["--printsrcinfo"], { cwd: work, encoding: "utf8" }),
);
console.log(`Generated ${join(work, "PKGBUILD")}`);

if (!push) {
  console.log("\nAdd --push to commit this to the AUR.");
  process.exit(0);
}
const checkout = join(work, "aur");
if (await exists(join(checkout, ".git"))) {
  execFileSync("git", ["-C", checkout, "fetch", "origin"], {
    stdio: "inherit",
  });
  execFileSync("git", ["-C", checkout, "reset", "--hard", "origin/master"], {
    stdio: "inherit",
  });
} else {
  await rm(checkout, { recursive: true, force: true });
  execFileSync("git", ["clone", remote, checkout], { stdio: "inherit" });
}
for (const name of ["PKGBUILD", ".SRCINFO", "tomato-todo.desktop", "LICENSE"])
  await copyFile(join(work, name), join(checkout, name));
execFileSync("git", ["-C", checkout, "add", "-A"], { stdio: "inherit" });
const dirty = execFileSync("git", ["-C", checkout, "status", "--porcelain"], {
  encoding: "utf8",
}).trim();
if (!dirty) {
  console.log("AUR repository is already up to date");
  process.exit(0);
}
execFileSync(
  "git",
  ["-C", checkout, "commit", "-m", `upgpkg: ${pkgname} ${version}-1`],
  { stdio: "inherit" },
);
execFileSync("git", ["-C", checkout, "push", "origin", "HEAD:master"], {
  stdio: "inherit",
});
console.log(`\nPublished ${pkgname} ${version}-1 to AUR`);
