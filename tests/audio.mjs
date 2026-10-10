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
            results.push({
              cue,
              level,
              peak: data.reduce((m, n) => Math.max(m, Math.abs(n)), 0),
              tail: data.slice(-4800).every((n) => n === 0),
              finite: data.every(Number.isFinite),
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
