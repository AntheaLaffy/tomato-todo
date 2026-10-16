import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
} from "node:fs/promises";
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
  const installedHelper = join(
    home,
    ".local/lib/tomato-todo/install-desktop-integration.py",
  );
  const installedPlan = JSON.parse(
    execFileSync("python3", [installedHelper, "--home", home, "--dry-run"], {
      encoding: "utf8",
    }),
  );
  assert.match(installedPlan.extension, /gnome-shell/);
  assert.equal(
    JSON.parse(
      await readFile(
        join(
          home,
          ".local/lib/tomato-todo/desktop-integrations/gnome/metadata.json",
        ),
        "utf8",
      ),
    ).uuid,
    "tomato-guard@studio.tomato.todo",
  );
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

test("GNOME integration installs without enabling extensions or changing another home", async () => {
  const home = await mkdtemp(join(tmpdir(), "tomato-gnome-install-"));
  const args = ["scripts/install-desktop-integration.py", "--home", home];
  const plan = JSON.parse(
    execFileSync("python3", [...args, "--dry-run"], { encoding: "utf8" }),
  );
  assert.deepEqual(await readdir(home), []);
  execFileSync("python3", args);
  const metadata = JSON.parse(
    await readFile(join(plan.extension, "metadata.json"), "utf8"),
  );
  assert.equal(metadata.uuid, "tomato-guard@studio.tomato.todo");
  assert.match(
    await readFile(join(plan.extension, "extension.js"), "utf8"),
    /ListWindows/,
  );
  execFileSync("python3", args);
  await writeFile(
    join(plan.extension, "metadata.json"),
    JSON.stringify({ uuid: "someone-else" }),
  );
  assert.throws(
    () => execFileSync("python3", args, { stdio: "pipe" }),
    /Refusing to replace/,
  );
});

test("AUR package includes a usable GNOME integration installer", async () => {
  const work = await mkdtemp(join(tmpdir(), "tomato-aur-install-"));
  const srcdir = join(work, "src");
  const pkgdir = join(work, "pkg");
  await mkdir(join(srcdir, "agent"), { recursive: true });
  await mkdir(join(srcdir, "icons"));
  for (const name of ["tomato-todo", "LICENSE", "tomato-todo.desktop"])
    await writeFile(join(srcdir, name), name);
  for (const name of ["32x32.png", "128x128.png", "128x128@2x.png"])
    await writeFile(join(srcdir, "icons", name), name);
  await cp("desktop-integrations", join(srcdir, "desktop-integrations"), {
    recursive: true,
  });
  await cp(
    "scripts/install-desktop-integration.py",
    join(srcdir, "install-desktop-integration.py"),
  );
  execFileSync(
    "bash",
    [
      "-e",
      "-c",
      'source "$1"; package',
      "aur-package",
      "packaging/aur/PKGBUILD.in",
    ],
    {
      env: { ...process.env, srcdir, pkgdir },
    },
  );
  const home = join(work, "home");
  const installer = join(
    pkgdir,
    "usr/lib/Tomato Todo/install-desktop-integration.py",
  );
  const plan = JSON.parse(
    execFileSync("python3", [installer, "--home", home], { encoding: "utf8" }),
  );
  assert.equal(
    JSON.parse(await readFile(join(plan.extension, "metadata.json"), "utf8"))
      .uuid,
    "tomato-guard@studio.tomato.todo",
  );
  assert.match(
    await readFile(join(plan.extension, "extension.js"), "utf8"),
    /ListWindows/,
  );
});
