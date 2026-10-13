import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, cp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { nodeVersion } from "../scripts/agent-runtime.mjs";

test("unsupported or empty target leaves an existing runtime bundle intact", async () => {
  const root = await mkdtemp(join(tmpdir(), "tomato-runtime-"));
  try {
    await mkdir(join(root, "scripts"));
    for (const script of ["build-agent.mjs", "agent-runtime.mjs"])
      await cp(resolve("scripts", script), join(root, "scripts", script));
    await mkdir(join(root, "agent/bundle"), { recursive: true });
    const sentinel = join(root, "agent/bundle/existing-runtime");
    await writeFile(sentinel, "keep");
    for (const target of [
      "aarch64-linux-android",
      "x86_64-unknown-linux-musl",
      "",
    ]) {
      const result = spawnSync(
        process.execPath,
        [join(root, "scripts/build-agent.mjs"), `--target=${target}`],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /No bundled desktop Node runtime|Usage:/);
      assert.equal(await readFile(sentinel, "utf8"), "keep");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("packaged runtime runs the actual Pi SDK without a system Node dependency", () => {
  const executable = resolve(
    "agent/bundle/bin",
    process.platform === "win32" ? "node.exe" : "node",
  );
  assert.equal(
    execFileSync(executable, ["--version"], { encoding: "utf8" }).trim(),
    `v${nodeVersion}`,
  );
  const sdk = pathToFileURL(
    resolve(
      "agent/bundle/node_modules/@earendil-works/pi-coding-agent/dist/index.js",
    ),
  ).href;
  const output = execFileSync(
    executable,
    [
      "--use-env-proxy",
      "--input-type=module",
      "-e",
      `const sdk = await import(${JSON.stringify(sdk)}); if (typeof sdk.ModelRuntime !== 'function') throw new Error('Pi SDK missing'); console.log('Pi SDK loaded');`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(output.trim(), "Pi SDK loaded");
});
