#!/usr/bin/env node
/**
 * Link this package's bundled skills into other agents' skill directories.
 *
 * The plugin already does this on mount (into the agent roots that exist); use
 * this command when you want a specific directory, a dry run, or a report.
 *
 *   node link-skills.mjs                     link into ~/.agents/skills
 *   node link-skills.mjs --all               also every known agent root that exists
 *   node link-skills.mjs --dir PATH ...      link into the given directories
 *   node link-skills.mjs --check             report only; exit 1 when a link is missing or stale
 *   node link-skills.mjs --remove            remove only the links this package created
 *
 * Options: --force (replace a symlink that points elsewhere), --relative
 * (store relative instead of absolute link targets), --dry-run, --help.
 *
 * It never deletes a real directory or file: move the old copy away and run
 * again. See link-skills.js for the operations themselves.
 */
import { homedir } from "node:os";
import { AGENT_SKILL_DIRS, SHARED_SKILL_DIR, expandHome, isDirectory, linkSkills } from "./link-skills.js";

const LABEL = "@local/tomato-dsh";

const options = {
  dirs: [],
  all: false,
  check: false,
  remove: false,
  force: false,
  relative: false,
  dryRun: false,
};

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--dir") {
    const value = process.argv[index + 1];
    if (value === undefined) usage("--dir needs a path");
    options.dirs.push(expandHome(value));
    index += 1;
  } else if (argument === "--all") options.all = true;
  else if (argument === "--check") options.check = true;
  else if (argument === "--remove") options.remove = true;
  else if (argument === "--force") options.force = true;
  else if (argument === "--relative") options.relative = true;
  else if (argument === "--dry-run") options.dryRun = true;
  else if (argument === "--help" || argument === "-h") usage();
  else usage(`unknown argument: ${argument}`);
}

const dirs =
  options.dirs.length > 0
    ? options.dirs
    : [SHARED_SKILL_DIR, ...(options.all ? AGENT_SKILL_DIRS.filter(isDirectory) : [])];

const result = linkSkills({
  dirs,
  remove: options.remove,
  force: options.force,
  relative: options.relative,
  dryRun: options.dryRun || options.check,
  create: !options.check,
});

let failures = 0;
for (const entry of result.entries) {
  const where = entry.linkPath === undefined ? display(entry.dir) : display(entry.linkPath);
  switch (entry.action) {
    case "ok":
      if (options.check) console.log(`ok      ${where}`);
      break;
    case "link":
      if (options.check) fail(`missing ${where}`);
      else console.log(`link    ${where} -> ${display(entry.target)}`);
      break;
    case "replace":
      if (options.check) fail(`stale ${where} -> ${display(entry.target)}`);
      else console.log(`replace ${where} -> ${display(entry.target)}`);
      break;
    case "unlink":
      console.log(`unlink  ${where}`);
      break;
    case "mkdir":
      if (!options.check) console.log(`mkdir   ${where}`);
      break;
    case "skip":
      fail(`${where} skipped: ${entry.message}`);
      break;
    default:
      break;
  }
}

process.exitCode = failures === 0 ? 0 : 1;

function fail(message) {
  failures += 1;
  console.log(`${options.check ? "error  " : "skip   "}${message}`);
}

function display(path) {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function usage(message) {
  if (message !== undefined) console.error(`${LABEL}: ${message}`);
  console.error(`Usage: node link-skills.mjs [--dir PATH]... [--all] [--check] [--remove] [--force] [--relative] [--dry-run]

Without arguments, links into ${display(SHARED_SKILL_DIR)}.`);
  process.exit(message === undefined ? 0 : 2);
}
