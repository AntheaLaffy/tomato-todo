// 背景音与关键节点音效：纯 Web Audio 合成，不依赖任何外部音频文件。
//
// 为什么单独成模块：HUD 与沉浸层都要读/改同一个「背景音选择」，而 AudioContext
// 必须由用户手势解锁、整个客户端只能有一个；放进模块级单例后，组件只订阅选择，
// 引擎的生命周期集中在 useSound()（常驻 HUD）里，沉浸层用 useAmbience() 只读。
//
// 环境约束（冒烟测试没有 window.AudioContext，SSR 也会执行模块顶层与渲染）：
// 顶层只注册文案和常量；AudioContext 只在 ensureAudio()（用户手势）里创建；
// 所有 window/document/localStorage 访问都做 typeof 守卫并用 try/catch 兜底，
// 任何导出函数都不向调用方抛异常。
import { useEffect, useState } from "../runtime.js";
import { registerCopy } from "../shared/copy.js";
import { dispatch, getSnapshot, useSnapshot } from "../shared/store.js";

registerCopy("sound", {
  zh: {
    title: "背景音",
    playing: "播放中",
    rain: "雨声",
    brown: "棕噪音",
    silent: "静音",
    volume: "音量",
    mutedHint: "关键节点音效已关闭",
  },
  en: {
    title: "Ambient sound",
    playing: "Playing",
    rain: "Rain",
    brown: "Brown noise",
    silent: "Silent",
    volume: "Volume",
    mutedHint: "Sound cues are off",
  },
});

/** 可选背景音；顺序即菜单顺序。 */
export const AMBIENCE_KINDS = ["silent", "rain", "brown"];

const STORAGE_KEY = "tomato-dsh.ambient";
// 淡入淡出时长必须 ≥500ms：噪声 BufferSource 直接 stop 会在非零振幅处截断产生爆音。
const FADE_SECS = 0.6;
const DEFAULT_VOLUME = 0.6;

let warned = false;

/** 只报一次：错误不该在每个 1.2s 的轮询里刷满 console。 */
function warnOnce(err) {
  if (warned) return;
  warned = true;
  try {
    if (
      typeof console !== "undefined" &&
      console &&
      typeof console.warn === "function"
    ) {
      console.warn("[tomato] sound:", err && err.message ? err.message : err);
    }
  } catch {
    /* console 不可用时静默 */
  }
}

function isKind(value) {
  return AMBIENCE_KINDS.indexOf(value) >= 0;
}

// ---------- 设置与音量 ----------
// 模块级快照镜像：useSound() 在 effect 里同步，事件处理器（setAmbience/ensureAudio）
// 只读这里，不依赖某次 render 是否已经发生。
let settingsSound = false; // 只有显式 === true 才算开启（core 默认值缺失时不擅自发声）
let settingsVolume = DEFAULT_VOLUME; // 归一化到 0..1
let timerFocusRunning = false;
let appliedVolume = -1;
// 用户刚通过 setVolume 改过、尚未被快照确认的音量：轮询回来的旧快照不能把它顶掉。
let pendingVolume = null;

/** 0–100 整数与 0–1 小数都接受；其它输入返回 null（表示「没有可用值」）。 */
function normalizeVolume(value) {
  let n = NaN;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 0;
  const unit = n <= 1 ? n : n / 100;
  return Math.min(1, Math.max(0, unit));
}

function readVolume(settings) {
  if (pendingVolume !== null) return pendingVolume;
  const v = normalizeVolume(settings && settings.soundVolume);
  return v === null ? settingsVolume : v;
}

/** 把最新快照里的声音开关、音量、计时器状态镜像到模块级变量。 */
function syncFromSnapshot() {
  const snap = getSnapshot();
  const data = snap && snap.data;
  if (!data) return;
  const settings = data.settings;
  if (settings) {
    settingsSound = settings.sound === true;
    const volume = normalizeVolume(settings.soundVolume);
    if (volume !== null) {
      // 快照追上了本地乐观值 → 释放 override；否则保留用户刚拖到的音量。
      if (pendingVolume !== null && Math.abs(volume - pendingVolume) < 0.005)
        pendingVolume = null;
      settingsVolume = pendingVolume !== null ? pendingVolume : volume;
    }
  }
  const timer = data.timer;
  timerFocusRunning = !!(
    timer &&
    timer.running === true &&
    timer.mode === "focus"
  );
}

// ---------- 音量（立即生效 + 防抖持久化） ----------
let volumeSaveTimer = null;
const VOLUME_SAVE_DELAY = 400; // 拖滑杆时只在停手后写一次磁盘/运行时

/** 当前有效音量（0–1）：优先本地乐观值，其次快照里的 soundVolume。 */
export function getVolume() {
  try {
    if (pendingVolume !== null) return pendingVolume;
    const snap = getSnapshot();
    const settings = snap && snap.data && snap.data.settings;
    const value = normalizeVolume(settings && settings.soundVolume);
    return value === null ? settingsVolume : value;
  } catch {
    return settingsVolume;
  }
}

/**
 * 改音量：立即改 master gain（有 context 时 180ms 平滑 ramp），
 * 400ms 防抖后用完整 settings 调 saveSettings 持久化；失败静默，不 notify、不抛。
 */
export function setVolume(value) {
  try {
    const next = normalizeVolume(value);
    if (next === null) return;
    pendingVolume = next;
    settingsVolume = next;
    applyVolume();
    scheduleVolumeSave();
  } catch (e) {
    warnOnce(e);
  }
}

function scheduleVolumeSave() {
  try {
    if (volumeSaveTimer !== null) clearTimeout(volumeSaveTimer);
    volumeSaveTimer = setTimeout(saveVolumeNow, VOLUME_SAVE_DELAY);
  } catch (e) {
    warnOnce(e);
  }
}

function saveVolumeNow() {
  volumeSaveTimer = null;
  try {
    const snap = getSnapshot();
    const settings = snap && snap.data && snap.data.settings;
    if (!settings) return; // 没有快照就拼不出完整 Settings；保留本地音量等下一次
    const target = pendingVolume !== null ? pendingVolume : settingsVolume;
    const soundVolume = Math.round(Math.min(1, Math.max(0, target)) * 100);
    const current = normalizeVolume(settings.soundVolume);
    if (current !== null && Math.round(current * 100) === soundVolume) {
      pendingVolume = null;
      return;
    }
    const pending = dispatch({
      type: "saveSettings",
      settings: Object.assign({}, settings, { soundVolume }),
    });
    if (!pending || typeof pending.then !== "function") return;
    // 成功时无需清 pending：后续快照 effect 里的 syncFromSnapshot() 发现
    // soundVolume 已等于本地值就会自动释放 override；失败则保留本地音量。
    pending.catch((e) => {
      warnOnce(e); // 失败静默：不 notify、不回滚本地音量
    });
  } catch (e) {
    warnOnce(e);
  }
}

// ---------- 背景音选择（localStorage 持久化） ----------
let ambienceKind = null; // null = 还没读过 localStorage
const ambienceListeners = new Set();

function readAmbience() {
  if (ambienceKind !== null) return ambienceKind;
  let stored = null;
  try {
    if (
      typeof localStorage !== "undefined" &&
      localStorage &&
      typeof localStorage.getItem === "function"
    ) {
      stored = localStorage.getItem(STORAGE_KEY);
    }
  } catch (e) {
    warnOnce(e);
  }
  const value = stored === "off" ? "silent" : stored; // 旧值 "off" 视作静音
  ambienceKind = isKind(value) ? value : "silent";
  return ambienceKind;
}

function persistAmbience(kind) {
  try {
    if (
      typeof localStorage !== "undefined" &&
      localStorage &&
      typeof localStorage.setItem === "function"
    ) {
      localStorage.setItem(STORAGE_KEY, kind);
    }
  } catch (e) {
    warnOnce(e); // 隐私模式：只在本次会话生效
  }
}

function emitAmbience() {
  for (const fn of Array.from(ambienceListeners)) {
    try {
      fn();
    } catch {
      /* 订阅者异常不影响其他订阅者 */
    }
  }
}

/** 当前背景音选择（非法/读不到时回落到 "silent"）。 */
export function getAmbience() {
  return readAmbience();
}

/** 修改背景音：先确保音频已解锁，再校验、持久化、通知订阅者；播放中立即交叉淡化。 */
export function setAmbience(kind) {
  ensureAudio();
  try {
    const requested = kind === "off" ? "silent" : kind; // 旧值 "off" 视作静音
    const next = isKind(requested) ? requested : "silent";
    const changed = next !== readAmbience();
    ambienceKind = next;
    persistAmbience(next);
    if (changed) emitAmbience();
    syncAmbientEngine();
  } catch (e) {
    warnOnce(e);
  }
}

// ---------- AudioContext 单例与音量总线 ----------
let audioCtx = null;
let master = null; // 唯一的 master GainNode：音量滑杆作用于背景音与音效
let cueBus = null; // 音效汇流，挂到 master 之后自然继承音量
let unlocked = false; // 是否已经过用户手势（autoplay 策略）

function getAudioCtor() {
  try {
    if (typeof window === "undefined" || !window) return null;
    const ctor = window.AudioContext || window.webkitAudioContext;
    return typeof ctor === "function" ? ctor : null;
  } catch {
    return null;
  }
}

/** 浏览器标准实现总有 state；缺省（测试替身）按 running 处理。 */
function stateOf(ctx) {
  return ctx && typeof ctx.state === "string" ? ctx.state : "running";
}

function getOrCreateContext() {
  if (audioCtx) return audioCtx;
  const Ctor = getAudioCtor();
  if (!Ctor) return null;
  try {
    const ctx = new Ctor();
    audioCtx = ctx;
    master = ctx.createGain();
    master.gain.value = settingsVolume;
    appliedVolume = settingsVolume;
    master.connect(ctx.destination);
    try {
      ctx.onstatechange = () => {
        if (audioCtx === ctx && stateOf(ctx) === "running") {
          unlocked = true;
          syncAmbientEngine();
        }
      };
    } catch {
      /* 某些实现是只读属性 */
    }
    return ctx;
  } catch (e) {
    audioCtx = null;
    master = null;
    cueBus = null;
    appliedVolume = -1;
    warnOnce(e);
    return null;
  }
}

/**
 * 用户手势里调用。创建/恢复 AudioContext，可重复调用；解锁后若条件满足立刻开始背景音。
 * 不在手势里调用也不会抛异常，只是浏览器可能保持 suspended。
 */
export function ensureAudio() {
  try {
    const ctx = getOrCreateContext();
    if (!ctx) return;
    if (stateOf(ctx) === "running") {
      unlocked = true;
      syncAmbientEngine();
      return;
    }
    if (typeof ctx.resume !== "function") return;
    const afterResume = () => {
      try {
        if (audioCtx !== ctx || stateOf(ctx) !== "running") return;
        unlocked = true;
        syncAmbientEngine();
      } catch (e) {
        warnOnce(e);
      }
    };
    const pending = ctx.resume();
    if (pending && typeof pending.then === "function")
      pending.then(afterResume, () => {});
    else afterResume();
  } catch (e) {
    warnOnce(e);
  }
}

function isReady() {
  return !!(unlocked && audioCtx && stateOf(audioCtx) === "running");
}

/** 线性 ramp；cancelAndHold 让「淡出途中再次改变」也从当前振幅继续。 */
function rampTo(param, value, seconds) {
  const ctx = audioCtx;
  if (!ctx || !param) return;
  const now = typeof ctx.currentTime === "number" ? ctx.currentTime : 0;
  try {
    if (typeof param.cancelAndHoldAtTime === "function")
      param.cancelAndHoldAtTime(now);
    else {
      if (typeof param.cancelScheduledValues === "function")
        param.cancelScheduledValues(now);
      if (typeof param.setValueAtTime === "function")
        param.setValueAtTime(param.value, now);
    }
    param.linearRampToValueAtTime(value, now + seconds);
  } catch {
    try {
      param.value = value;
    } catch {
      /* 忽略 */
    }
  }
}

function applyVolume() {
  if (!master || appliedVolume === settingsVolume) return;
  appliedVolume = settingsVolume;
  rampTo(master.gain, settingsVolume, 0.18);
}

// ---------- 噪声合成 ----------
function normalizePeak(out, target) {
  let peak = 0;
  for (let i = 0; i < out.length; i += 1) {
    const a = out[i] < 0 ? -out[i] : out[i];
    if (a > peak) peak = a;
  }
  if (peak <= 0) return;
  const k = target / peak;
  for (let i = 0; i < out.length; i += 1) out[i] *= k;
}

/**
 * 环形无缝噪声 buffer：多生成一段尾部，再用交叉淡化把尾部混进头部，
 * 循环点两侧样本在原始序列里相邻，因此接缝处不会有振幅跳变（棕噪音尤其明显）。
 */
function makeNoiseBuffer(ctx, brown) {
  const rate =
    typeof ctx.sampleRate === "number" && ctx.sampleRate > 0
      ? ctx.sampleRate
      : 44100;
  const seconds = brown ? 4 : 3;
  const length = Math.max(256, Math.floor(rate * seconds));
  const fade = Math.min(length >> 2, Math.max(64, Math.floor(rate * 0.25)));
  const total = length + fade;
  const data = new Float32Array(total);
  if (brown) {
    // 随机游走积分噪声：低频能量集中，听感温暖平缓。
    let last = 0;
    for (let i = 0; i < total; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + white * 0.02) * 0.996;
      if (last > 1) last = 1;
      else if (last < -1) last = -1;
      data[i] = last;
    }
  } else {
    for (let i = 0; i < total; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const buffer = ctx.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  for (let i = 0; i < fade; i += 1) {
    const w = i / fade;
    out[i] = data[i] * w + data[length + i] * (1 - w);
  }
  for (let i = fade; i < length; i += 1) out[i] = data[i];
  normalizePeak(out, 0.92);
  return buffer;
}

/** 雨声：白噪声 → highpass 500Hz → lowpass ~5.4kHz（极慢 LFO 微调）→ 缓慢起伏的增益。 */
function buildRain(ctx) {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, false);
  src.loop = true;

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 500;
  highpass.Q.value = 0.6;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 5400;
  lowpass.Q.value = 0.4;

  const trem = ctx.createGain();
  trem.gain.value = 0.36;

  const filterLfo = ctx.createOscillator();
  filterLfo.type = "sine";
  filterLfo.frequency.value = 0.06;
  const filterDepth = ctx.createGain();
  filterDepth.gain.value = 1200;
  filterLfo.connect(filterDepth);
  filterDepth.connect(lowpass.frequency);

  const gainLfo = ctx.createOscillator();
  gainLfo.type = "sine";
  gainLfo.frequency.value = 0.043;
  const gainDepth = ctx.createGain();
  gainDepth.gain.value = 0.04;
  gainLfo.connect(gainDepth);
  gainDepth.connect(trem.gain);

  src.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(trem);

  return {
    output: trem,
    startables: [src, filterLfo, gainLfo],
    nodes: [
      src,
      highpass,
      lowpass,
      trem,
      filterLfo,
      filterDepth,
      gainLfo,
      gainDepth,
    ],
  };
}

/** 棕噪音：随机游走 → lowpass 900Hz → 轻微增益呼吸。 */
function buildBrown(ctx) {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, true);
  src.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 900;
  lowpass.Q.value = 0.5;

  const trem = ctx.createGain();
  trem.gain.value = 0.48;

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.031;
  const depth = ctx.createGain();
  depth.gain.value = 0.03;
  lfo.connect(depth);
  depth.connect(trem.gain);

  src.connect(lowpass);
  lowpass.connect(trem);

  return {
    output: trem,
    startables: [src, lfo],
    nodes: [src, lowpass, trem, lfo, depth],
  };
}

// ---------- 背景音生命周期 ----------
let active = null; // { kind, gain, graph, stopped, timer }

function teardownEntry(entry, stopSources) {
  if (!entry) return;
  if (entry.timer !== null) {
    try {
      clearTimeout(entry.timer);
    } catch {
      /* 忽略 */
    }
    entry.timer = null;
  }
  if (entry.graph) {
    if (stopSources) {
      for (const node of entry.graph.startables) {
        try {
          if (node && typeof node.stop === "function") node.stop();
        } catch {
          /* 已经停止过 */
        }
      }
    }
    for (const node of entry.graph.nodes) {
      try {
        node.disconnect();
      } catch {
        /* 忽略 */
      }
    }
  }
  try {
    entry.gain.disconnect();
  } catch {
    /* 忽略 */
  }
}

function stopEntry(entry) {
  teardownEntry(entry, true);
}

function fadeOutAndStop(entry) {
  if (!entry || entry.stopped) return;
  entry.stopped = true;
  rampTo(entry.gain.gain, 0, FADE_SECS);
  try {
    entry.timer = setTimeout(
      () => stopEntry(entry),
      Math.round(FADE_SECS * 1000) + 120,
    );
  } catch {
    stopEntry(entry);
  }
}

function startAmbient(kind) {
  const ctx = audioCtx;
  if (!ctx || !master) return;
  if (active && active.kind === kind) return;
  const graph =
    kind === "rain"
      ? buildRain(ctx)
      : kind === "brown"
        ? buildBrown(ctx)
        : null;
  if (!graph) return;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  const entry = { kind, gain, graph, stopped: false, timer: null };
  try {
    graph.output.connect(gain);
    gain.connect(master);
    for (const node of graph.startables) node.start();
  } catch (e) {
    teardownEntry(entry, true);
    warnOnce(e);
    return;
  }
  rampTo(gain.gain, 1, FADE_SECS);

  const prev = active;
  active = entry;
  if (prev && !prev.stopped) fadeOutAndStop(prev); // 切换 kind：两段同时 ramp，交叉淡化
}

function stopAmbient() {
  if (!active) return;
  const entry = active;
  active = null;
  fadeOutAndStop(entry);
}

/** 唯一判定入口：声音开关 + 专注运行 + 非静音 + 已解锁。 */
function shouldPlayAmbience() {
  return !!(
    settingsSound &&
    timerFocusRunning &&
    isKind(getAmbience()) &&
    getAmbience() !== "silent" &&
    isReady()
  );
}

/** 根据模块级状态与快照，把引擎推进到正确状态（幂等，可频繁调用）。 */
function syncAmbientEngine() {
  try {
    if (!audioCtx || !master) return;
    syncFromSnapshot();
    applyVolume();
    if (!shouldPlayAmbience()) {
      stopAmbient();
      return;
    }
    startAmbient(getAmbience());
  } catch (e) {
    warnOnce(e);
  }
}

// ---------- 关键节点音效 ----------
// 全部为 ≤880Hz 的正弦短音 + 指数衰减包络；峰值远低于背景音，避免刺耳。
const CUES = {
  start: [
    { f: 523.25, at: 0, dur: 0.16, peak: 0.05 },
    { f: 783.99, at: 0.07, dur: 0.18, peak: 0.045 },
  ],
  pause: [
    { f: 440, at: 0, dur: 0.14, peak: 0.045 },
    { f: 329.63, at: 0.07, dur: 0.16, peak: 0.04 },
  ],
  resume: [
    { f: 392, at: 0, dur: 0.14, peak: 0.045 },
    { f: 523.25, at: 0.07, dur: 0.18, peak: 0.045 },
  ],
  complete: [
    { f: 659.25, at: 0, dur: 0.16, peak: 0.05 },
    { f: 880, at: 0.08, dur: 0.18, peak: 0.045 },
  ],
  reminder: [
    { f: 587.33, at: 0, dur: 0.13, peak: 0.04 },
    { f: 783.99, at: 0.1, dur: 0.15, peak: 0.04 },
  ],
};

function ensureCueBus(ctx) {
  if (cueBus) return cueBus;
  try {
    cueBus = ctx.createGain();
    cueBus.gain.value = 1;
    cueBus.connect(master);
  } catch (e) {
    cueBus = null;
    warnOnce(e);
  }
  return cueBus;
}

function playTone(ctx, bus, when, note) {
  let osc = null;
  let gain = null;
  const cleanup = () => {
    try {
      if (osc) osc.disconnect();
    } catch {
      /* 忽略 */
    }
    try {
      if (gain) gain.disconnect();
    } catch {
      /* 忽略 */
    }
  };
  try {
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "sine";
    if (osc.frequency && typeof osc.frequency.setValueAtTime === "function") {
      osc.frequency.setValueAtTime(note.f, when);
    } else if (osc.frequency) {
      osc.frequency.value = note.f;
    }
    if (gain.gain && typeof gain.gain.setValueAtTime === "function") {
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(note.peak, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + note.dur);
    } else if (gain.gain) {
      gain.gain.value = note.peak;
    }
    osc.connect(gain);
    gain.connect(bus);
    osc.start(when);
    osc.stop(when + note.dur + 0.06);
    try {
      osc.onended = cleanup;
    } catch {
      /* 忽略 */
    }
    // onended 在部分实现里不触发；补一个兜底清理，避免节点泄漏。
    try {
      setTimeout(cleanup, Math.round((note.at + note.dur + 0.35) * 1000));
    } catch {
      /* 忽略 */
    }
  } catch (e) {
    cleanup();
    warnOnce(e);
  }
}

/**
 * 关键节点音效：name 取 "start" | "pause" | "resume" | "complete" | "reminder"。
 * settings.sound === false 或 audio 尚未解锁时静默返回。
 */
export function playCue(name) {
  try {
    syncFromSnapshot();
    if (!settingsSound || !isReady()) return;
    const notes = CUES[name];
    if (!notes || notes.length === 0) return;
    const bus = ensureCueBus(audioCtx);
    if (!bus) return;
    const base =
      (typeof audioCtx.currentTime === "number" ? audioCtx.currentTime : 0) +
      0.01;
    for (const note of notes) playTone(audioCtx, bus, base + note.at, note);
  } catch (e) {
    warnOnce(e);
  }
}

// ---------- React 接入 ----------
function getDocument() {
  try {
    if (
      typeof document !== "undefined" &&
      document &&
      typeof document.addEventListener === "function"
    ) {
      return document;
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

/** 一次性手势监听：capture 阶段先于按钮 handler，确保 start 音效已有可用 context。 */
function installUnlockListeners() {
  const doc = getDocument();
  if (!doc) return undefined;
  let armed = true;
  const remove = () => {
    try {
      doc.removeEventListener("pointerdown", onGesture, true);
    } catch {
      /* 忽略 */
    }
    try {
      doc.removeEventListener("keydown", onGesture, true);
    } catch {
      /* 忽略 */
    }
  };
  function onGesture() {
    if (!armed) return;
    armed = false;
    remove();
    ensureAudio();
  }
  try {
    doc.addEventListener("pointerdown", onGesture, {
      capture: true,
      passive: true,
    });
    doc.addEventListener("keydown", onGesture, {
      capture: true,
      passive: true,
    });
  } catch (e) {
    // 老实现不接受 options 对象时退回布尔 capture。
    try {
      doc.addEventListener("pointerdown", onGesture, true);
      doc.addEventListener("keydown", onGesture, true);
    } catch {
      warnOnce(e);
      return undefined;
    }
  }
  return () => {
    armed = false;
    remove();
  };
}

function subscribeAmbience(fn) {
  ambienceListeners.add(fn);
  return () => ambienceListeners.delete(fn);
}

function useAmbienceSelection() {
  const [ambience, setView] = useState(getAmbience);
  useEffect(() => subscribeAmbience(() => setView(getAmbience())), []);
  return [ambience, setView];
}

function settingsView(state) {
  const data = state && state.data;
  const settings = data && data.settings;
  return {
    enabled: settings ? settings.sound === true : false,
    volume: readVolume(settings),
    focusRunning: !!(
      data &&
      data.timer &&
      data.timer.running === true &&
      data.timer.mode === "focus"
    ),
  };
}

/**
 * HUD（常驻、永远挂载）用：同步 settings、管理引擎、注册自动解锁监听。
 * 返回 { kind, ambience, volume, setKind, setAmbience, setVolume, enabled, playCue }；
 * volume 归一化到 0..1。
 */
export function useSound() {
  const state = useSnapshot();
  const view = settingsView(state);
  const [ambience] = useAmbienceSelection();

  // 快照变化 → 模块级镜像 + 引擎状态（暂停/休息/停止都会在这里淡出）。
  useEffect(() => {
    syncFromSnapshot();
    syncAmbientEngine();
  }, [view.enabled, view.volume, view.focusRunning]);

  // 首次用户手势解锁；之后的按钮 handler 仍应继续调用 ensureAudio()。
  useEffect(() => installUnlockListeners(), []);

  return {
    kind: ambience,
    ambience,
    volume: view.volume,
    setKind: setAmbience,
    setAmbience,
    setVolume,
    enabled: view.enabled,
    playCue,
  };
}

/**
 * 沉浸层/专注页菜单用：只订阅选择变化，不管理引擎（引擎归常驻的 HUD）。
 * 返回 { kind, ambience, volume, setKind, setAmbience, setVolume, enabled, playCue }。
 */
export function useAmbience() {
  const state = useSnapshot();
  const view = settingsView(state);
  const [ambience] = useAmbienceSelection();
  return {
    kind: ambience,
    ambience,
    volume: view.volume,
    setKind: setAmbience,
    setAmbience,
    setVolume,
    enabled: view.enabled,
    playCue,
  };
}
