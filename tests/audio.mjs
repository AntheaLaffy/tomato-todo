import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { chromium } from "@playwright/test";

async function source(path) {
  return ts.transpileModule(await readFile(path, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
}
const events = await import(
  `data:text/javascript;base64,${Buffer.from(await source("src/sound-events.ts")).toString("base64")}`
);
const snapshot = () => ({
  today: "2026-10-10",
  data: {
    settings: { sound: true, soundVolume: 40 },
    timer: {
      running: false,
      startedAt: null,
      mode: "focus",
      completionSerial: 0,
      lastFinishedMode: null,
      durationSecs: 1500,
      remainingSecs: 1500,
    },
    lock: { active: null },
    tasks: [],
  },
});
function transition(change, action, before = snapshot()) {
  const after = structuredClone(before);
  change(after.data);
  return events.soundForTransition(
    before,
    after,
    action && { type: action, id: "task" },
  );
}

test("sound follows study transitions once, including automatic boundaries and silence", () => {
  assert.equal(events.soundForTransition(undefined, snapshot()), null);
  assert.equal(events.soundForTransition(snapshot(), snapshot()), null);
  assert.equal(
    transition((d) => (d.timer.running = true), "startTimer"),
    "start",
  );
  const running = snapshot();
  running.data.timer.running = true;
  running.data.timer.startedAt = 100;
  assert.equal(
    transition((d) => (d.timer.running = false), "pauseTimer", running),
    "pause",
  );
  assert.equal(
    transition((d) => (d.timer.running = false), undefined, running),
    "pause",
  );
  const paused = structuredClone(running);
  paused.data.timer.running = false;
  assert.equal(
    transition((d) => (d.timer.running = true), "startTimer", paused),
    "resume",
  );
  assert.equal(
    transition(
      (d) => {
        d.timer.running = false;
        d.timer.mode = "shortBreak";
        d.timer.completionSerial++;
        d.timer.lastFinishedMode = "focus";
      },
      undefined,
      running,
    ),
    "focusEnd",
  );
  assert.equal(
    transition(
      (d) => {
        d.timer.mode = "shortBreak";
        d.timer.completionSerial++;
        d.timer.lastFinishedMode = "focus";
      },
      undefined,
      running,
    ),
    "focusEnd",
  );
  assert.equal(
    transition((d) => {
      d.timer.running = true;
      d.timer.completionSerial++;
      d.timer.lastFinishedMode = "longBreak";
    }),
    "breakEnd",
  );
  assert.equal(
    transition((d) => {
      d.timer.mode = "shortBreak";
    }, "setMode"),
    "breakStart",
  );
  assert.equal(
    transition(
      (d) => {
        d.timer.running = false;
        d.timer.startedAt = null;
      },
      "resetTimer",
      running,
    ),
    "stop",
  );
  assert.equal(
    transition((d) => (d.lock.active = { endsAt: 100 })),
    "lockStart",
  );
  const locked = snapshot();
  locked.data.lock.active = { endsAt: 100 };
  assert.equal(
    transition((d) => (d.lock.active = null), undefined, locked),
    "lockEnd",
  );
  assert.equal(
    transition((d) => {
      d.timer.running = true;
      d.settings.sound = false;
    }, "startTimer"),
    null,
  );
  assert.equal(
    transition((d) => {
      d.timer.running = true;
      d.settings.soundVolume = 0;
    }, "startTimer"),
    null,
  );
  assert.equal(
    transition((d) => (d.timer.running = true), "import"),
    null,
  );
});

test("reminders match the banner queue and stay quiet during paused study or restore", () => {
  const pending = {
    id: "task",
    dueDate: "2026-10-10",
    reminderTime: "09:00",
    reminderPending: true,
    completed: false,
  };
  const before = snapshot();
  before.data.tasks = [{ ...pending, reminderPending: false }];
  assert.equal(
    transition((d) => (d.tasks[0].reminderPending = true), undefined, before),
    "reminder",
  );
  const after = structuredClone(before);
  after.data.tasks[0].reminderPending = true;
  assert.equal(events.soundForTransition(after, structuredClone(after)), null);
  assert.equal(
    transition((d) => (d.tasks[0].completed = true), "toggleTask", after),
    "taskComplete",
  );
  assert.equal(
    transition((d) => (d.tasks[0].completed = true), "import", after),
    null,
  );
  const done = structuredClone(after);
  done.data.tasks[0].completed = true;
  // Unchecking a scheduled task may reveal a reminder, but must not reward it.
  const untimed = snapshot();
  untimed.data.tasks = [{ id: "task", completed: true }];
  assert.equal(
    transition((d) => (d.tasks[0].completed = false), "toggleTask", untimed),
    null,
  );
  after.data.timer.startedAt = 100;
  after.data.timer.remainingSecs = 1000;
  assert.equal(events.pendingTaskReminder(after), undefined);
  assert.equal(
    transition((d) => (d.tasks[0].reminderPending = true), undefined, after),
    null,
  );
  after.data.timer.startedAt = null;
  after.data.timer.remainingSecs = 1500;
  after.data.tasks.push({ ...pending, id: "earlier", reminderTime: "08:00" });
  assert.equal(events.pendingTaskReminder(after).id, "earlier");
  assert.equal(
    transition(
      (d) => {
        d.lock.active = { endsAt: 100 };
        d.timer.completionSerial++;
        d.timer.lastFinishedMode = "focus";
      },
      undefined,
      before,
    ),
    "lockStart",
  );
});

test(
  "real Web Audio renders every cue with bounded peaks, clean tails and working volume",
  { timeout: 30000 },
  async () => {
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage();
      const code = await source("src/audio.ts");
      const results = await page.evaluate(async (code) => {
        const cues = [
          "start",
          "resume",
          "pause",
          "stop",
          "focusEnd",
          "breakEnd",
          "breakStart",
          "taskComplete",
          "reminder",
          "lockStart",
          "lockEnd",
        ];
        const results = [];
        for (const cue of cues) {
          for (const level of [0, 40, 100]) {
            const ctx = new OfflineAudioContext(1, 48000 * 2, 48000);
            window.AudioContext = function () {
              return new Proxy(ctx, {
                get(target, key) {
                  if (key === "state") return "running";
                  const value = target[key];
                  return typeof value === "function"
                    ? value.bind(target)
                    : value;
                },
              });
            };
            const url = URL.createObjectURL(
              new Blob([code], { type: "text/javascript" }),
            );
            const audio = await import(url);
            audio.playSound(cue, level);
            const data = (await ctx.startRendering()).getChannelData(0);
            let first = -1,
              last = -1;
            for (let i = 0; i < data.length; i++) {
              if (Math.abs(data[i]) > 0.002) {
                if (first === -1) first = i;
                last = i;
              }
            }
            results.push({
              cue,
              level,
              peak: data.reduce((m, n) => Math.max(m, Math.abs(n)), 0),
              tail: data.slice(-4800).every((n) => n === 0),
              finite: data.every(Number.isFinite),
              audibleSpan: first < 0 ? 0 : (last - first) / 48000,
            });
            URL.revokeObjectURL(url);
          }
        }
        // Blocked contexts must not queue historical cues for a future gesture.
        let scheduled = 0;
        let suspended = true;
        window.AudioContext = function () {
          return {
            get state() {
              return suspended ? "suspended" : "running";
            },
            currentTime: 0,
            resume: () => Promise.reject(new Error("autoplay blocked")),
            createOscillator: () => {
              scheduled++;
              throw new Error("must not schedule");
            },
          };
        };
        const blocked = await import(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
        );
        blocked.playSound("reminder", 40);
        suspended = false;
        blocked.unlockAudio();
        if (scheduled) throw new Error("Blocked bell was queued");
        // Interrupted bells should leave no audio behind after their brief fade.
        const ctx = new OfflineAudioContext(1, 48000, 48000);
        window.AudioContext = function () {
          return new Proxy(ctx, {
            get(target, key) {
              if (key === "state") return "running";
              const value = target[key];
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        };
        const replaced = await import(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
        );
        replaced.playSound("focusEnd", 40);
        replaced.playSound("start", 40);
        replaced.stopSound();
        const stopped = (await ctx.startRendering()).getChannelData(0);
        if (!stopped.slice(2400).every((n) => n === 0))
          throw new Error("Stopped bell kept playing");
        // Audio unavailability must not prevent ordinary interaction.
        window.AudioContext = function () {
          throw new Error("audio unavailable");
        };
        const audio = await import(
          URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
        );
        audio.unlockAudio();
        audio.playSound("start", 40);
        audio.setNoise("rain");
        return results;
      }, code);
      for (const result of results) {
        assert.ok(result.finite && result.tail, JSON.stringify(result));
        assert.ok(result.peak < 0.5, JSON.stringify(result));
        if (result.level === 0) assert.equal(result.peak, 0);
        else assert.ok(result.peak > 0.01, JSON.stringify(result));
        if (result.level === 100)
          assert.ok(
            result.audibleSpan >= 0.4 && result.audibleSpan < 1.8,
            JSON.stringify(result),
          );
      }
      for (const cue of new Set(results.map((r) => r.cue))) {
        const peak = (level) =>
          results.find((r) => r.cue === cue && r.level === level).peak;
        assert.ok(Math.abs(peak(40) / peak(100) - 0.4) < 0.001);
      }
    } finally {
      await browser.close();
    }
  },
);

test(
  "homework BGM validates real metadata, persists files and controls playback",
  { timeout: 30000 },
  async () => {
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/sbin/chromium",
      args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
    });
    try {
      const page = await browser.newPage();
      await page.route("http://bgm.test/**", (route) =>
        route.fulfill({ contentType: "text/html", body: "<html></html>" }),
      );
      await page.goto("http://bgm.test");
      const code = await source("src/bgm.ts");
      await page.evaluate(async (code) => {
        const moduleUrl = URL.createObjectURL(
          new Blob([code], { type: "text/javascript" }),
        );
        const bgm = await import(moduleUrl);
        function wav(seconds) {
          const count = seconds * 8000;
          const bytes = new Uint8Array(44 + count).fill(128);
          const view = new DataView(bytes.buffer);
          const text = (at, value) =>
            [...value].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));
          text(0, "RIFF");
          view.setUint32(4, 36 + count, true);
          text(8, "WAVE");
          text(12, "fmt ");
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, 1, true);
          view.setUint32(24, 8000, true);
          view.setUint32(28, 8000, true);
          view.setUint16(32, 1, true);
          view.setUint16(34, 8, true);
          text(36, "data");
          view.setUint32(40, count, true);
          return new File([bytes], `${seconds}.wav`, { type: "audio/wav" });
        }
        const check = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        check((await bgm.loadBgm()) === undefined, "initially empty");
        const track = await bgm.importBgm(wav(3600));
        check(track.duration === 3600, "exactly one hour accepted");
        const again = await import(moduleUrl + "#reload");
        const saved = await again.loadBgm();
        check(
          saved.name === track.name && saved.file.size === track.file.size,
          "file persisted independently of module",
        );
        for (const file of [
          wav(3599),
          new File(["broken"], "bad.mp3", { type: "audio/mpeg" }),
        ]) {
          let rejected = false;
          try {
            await bgm.importBgm(file);
          } catch {
            rejected = true;
          }
          check(rejected, "invalid or short audio rejected");
          check(
            (await bgm.loadBgm()).name === track.name,
            "failed import preserves original",
          );
        }
        const NativeAudio = window.Audio;
        let player;
        window.Audio = function (...args) {
          player = new NativeAudio(...args);
          return player;
        };
        await bgm.playBgm(saved, 0.2);
        check(
          !player.paused && player.loop && player.volume === 0.2,
          "plays and loops",
        );
        bgm.setBgmVolume(0);
        check(player.volume === 0, "independent volume");
        bgm.pauseBgm();
        check(player.paused, "pause");
        await bgm.playBgm(saved, 0.4);
        check(!player.paused && player.volume === 0.4, "resume");
        bgm.stopBgm();
        check(
          player.paused && !player.getAttribute("src"),
          "release playback source",
        );
        await bgm.removeBgm();
        check((await again.loadBgm()) === undefined, "persistent removal");
        URL.revokeObjectURL(moduleUrl);
      }, code);
    } finally {
      await browser.close();
    }
  },
);
