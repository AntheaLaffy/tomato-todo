import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("user installation preserves shell settings, validates launchers and is repeatable", async () => {
  const home = await mkdtemp(join(tmpdir(), "tomato install % "));
  const config = join(home, ".config/DankMaterialShell");
  const state = join(home, ".local/state/DankMaterialShell");
  await mkdir(config, { recursive: true });
  await mkdir(state, { recursive: true });
  const settings = {
    showDock: false,
    other: "keep",
    barConfigs: [
      {
        id: "default",
        leftWidgets: ["launcherButton", "focusedWindow"],
        rightWidgets: ["systemTray"],
      },
    ],
  };
  const session = {
    other: "keep",
    pinnedApps: ["existing"],
    barPinnedApps: ["another"],
  };
  await writeFile(join(config, "settings.json"), JSON.stringify(settings));
  await writeFile(join(state, "session.json"), JSON.stringify(session));
  const source = join(home, "source");
  await writeFile(source, "test binary");
  const args = [
    "scripts/install.py",
    "--home",
    home,
    "--binary",
    source,
    "--autostart",
    "--pin-dms",
  ];
  execFileSync("python3", [...args, "--dry-run"]);
  assert.deepEqual(
    JSON.parse(await readFile(join(config, "settings.json"))),
    settings,
  );
  execFileSync("python3", args);
  const first = JSON.parse(await readFile(join(config, "settings.json")));
  assert.equal(first.other, "keep");
  assert.equal(first.showDock, false);
  assert.deepEqual(first.barConfigs[0].leftWidgets, [
    "launcherButton",
    "appsDock",
    "focusedWindow",
  ]);
  const pins = JSON.parse(await readFile(join(state, "session.json")));
  assert.deepEqual(pins.pinnedApps, ["existing"]);
  assert.deepEqual(pins.barPinnedApps, ["another", "tomato-todo"]);
  execFileSync("python3", args);
  assert.deepEqual(
    JSON.parse(await readFile(join(config, "settings.json"))),
    first,
  );
  assert.equal(
    (
      await readdir(
        join(home, ".local/share/studio.tomato.todo/install-backups"),
      )
    ).length,
    1,
  );
  for (const path of [
    join(home, ".local/share/applications/tomato-todo.desktop"),
    join(home, ".config/autostart/studio.tomato.todo.desktop"),
  ]) {
    execFileSync("desktop-file-validate", [path]);
    assert.match(await readFile(path, "utf8"), /%%/);
  }
});
