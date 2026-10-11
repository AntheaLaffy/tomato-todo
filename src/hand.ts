// 助手的「手」：把一句句动作指令演成一段人看得懂的动画。
//
// 形状照抄成熟实现：matinee（可编程幽灵光标：moveTo/click/type/say，覆盖层
// pointer-events:none、aria-hidden、尊重 prefers-reduced-motion）与 demowright
// （可见光标 + 按键 HUD + 字幕 + 音效）。这里没有 React，所以手写成一层挂在
// body 上的覆盖层：位置用 transform 走贝塞尔路径（不是直线补间），点击有按压缩放
// 与涟漪，打字会浮出一块小键盘并逐键高亮，讲稿是手边浮出的文字框，一行一行带你读。
//
// 手不是「真的在动鼠标」：它演的是已经发生或即将发生的动作，按下时才会把真实事件
// 派发给目标元素（real: true），所以它既能解释软件做了什么，也能替用户点一下。

export type HandStep =
  | { kind: "move"; target?: string; x?: number; y?: number; ms?: number }
  | { kind: "click"; target?: string; x?: number; y?: number; real?: boolean }
  | { kind: "type"; target: string; text: string; cps?: number }
  | { kind: "highlight"; target: string; ms?: number }
  | { kind: "say"; lines: string | string[]; hold?: boolean }
  | { kind: "keyboard"; on: boolean }
  | { kind: "wait"; ms: number }
  | { kind: "hide" };

export type HandScript = {
  steps: HandStep[];
  /** 名牌上的名字，默认「助手」。 */
  label?: string;
  accent?: string;
};

export type HandOptions = {
  /** 音效开关与音量（跟随软件的「关键节点音效」设置）。 */
  sound?: () => { enabled: boolean; volume: number };
  /** 什么时候不该演：锁机、沉浸计时这类占满屏幕的状态。 */
  suppressed?: () => boolean;
  /** 每个动作前后的观感速度，1 为标准，>1 更慢。 */
  pace?: number;
};

type Point = { x: number; y: number };

const KEYS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
const keyLabels: Record<string, string> = {
  " ": "Space",
  enter: "Enter",
  tab: "Tab",
  "-": "-",
  _: "-",
  "，": ",",
  "。": ".",
};

let layer: HTMLElement | null = null;
let hand: HTMLElement | null = null;
let ripple: HTMLElement | null = null;
let keyboard: HTMLElement | null = null;
let caption: HTMLElement | null = null;
let options: HandOptions = {};
let at: Point = { x: 0, y: 0 };
let script: Promise<void> = Promise.resolve();
let reduced = false;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const pace = (ms: number) => Math.max(0, ms * (options.pace ?? 1));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// ---------------------------------------------------------------- 音效
// 一只手要发的音很多（每个键一次），所以自己拿一个音频上下文，不去碰应用那套
// 会互相打断的关键节点音效。
let audio: AudioContext | null = null;
function soundOn() {
  const setting = options.sound?.() ?? { enabled: false, volume: 0 };
  return setting.enabled && setting.volume > 0 ? setting.volume / 100 : 0;
}
function tone(
  frequency: number,
  duration: number,
  level: number,
  type: OscillatorType = "sine",
  detune = 0,
) {
  if (!level) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const start = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch {
    audio = null;
  }
}
/** 手的四种声音：移动的气声、点击的轻扣、按键的脆响、讲稿翻行的轻铃。 */
export function handSound(kind: "move" | "click" | "key" | "line", value = "") {
  const level = soundOn();
  if (!level) return;
  if (kind === "move") tone(1500, 0.06, level * 0.012, "triangle", -200);
  else if (kind === "click") {
    tone(320, 0.07, level * 0.05, "square");
    tone(90, 0.09, level * 0.05, "sine");
  } else if (kind === "key") {
    // 键盘按下的音高跟着按键位置走，敲一行字不会像打字机一样单调。
    const row = KEYS.findIndex((keys) => keys.includes(value));
    tone(
      900 - Math.max(0, row) * 90,
      0.035,
      level * 0.03,
      "square",
      rand(-30, 30),
    );
  } else tone(880, 0.18, level * 0.02, "sine");
}

// ---------------------------------------------------------------- 覆盖层
function build() {
  if (layer) return;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  layer = document.createElement("div");
  layer.id = "hand-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <div class="hand-actor">
      <span class="hand-ripple"></span>
      <svg class="hand-svg" viewBox="0 0 24 28" width="26" height="30" aria-hidden="true">
        <path class="hand-shadow" d="M7 2.2c1 0 1.7.8 1.7 1.8l.1 6.4 1.6-.3.4-8c.1-1 .9-1.8 1.9-1.7 1 .1 1.7.9 1.6 1.9l-.4 7.6 1.4-.2.9-6.2c.2-1 1.1-1.6 2.1-1.5 1 .2 1.6 1.1 1.5 2.1l-.9 6.6 1.3-.1 1-4.4c.2-1 1.2-1.6 2.2-1.4 1 .2 1.6 1.2 1.4 2.2l-1.6 8.1c-.5 2.6-2.7 4.5-5.4 4.5h-3.6c-2.2 0-4.2-1.4-5-3.4l-2.6-6.6c-.4-1 .1-2.1 1.1-2.4.5-.1 1 0 1.4.3l1.3 1.2-.6-6.4c-.1-1 .7-1.9 1.7-2z"/>
        <path class="hand-fill" d="M7 2.2c1 0 1.7.8 1.7 1.8l.1 6.4 1.6-.3.4-8c.1-1 .9-1.8 1.9-1.7 1 .1 1.7.9 1.6 1.9l-.4 7.6 1.4-.2.9-6.2c.2-1 1.1-1.6 2.1-1.5 1 .2 1.6 1.1 1.5 2.1l-.9 6.6 1.3-.1 1-4.4c.2-1 1.2-1.6 2.2-1.4 1 .2 1.6 1.2 1.4 2.2l-1.6 8.1c-.5 2.6-2.7 4.5-5.4 4.5h-3.6c-2.2 0-4.2-1.4-5-3.4l-2.6-6.6c-.4-1 .1-2.1 1.1-2.4.5-.1 1 0 1.4.3l1.3 1.2-.6-6.4c-.1-1 .7-1.9 1.7-2z"/>
      </svg>
      <span class="hand-label"></span>
    </div>
    <div class="hand-caption" hidden></div>
    <div class="hand-keyboard" hidden></div>`;
  document.body.appendChild(layer);
  hand = layer.querySelector<HTMLElement>(".hand-actor");
  ripple = layer.querySelector<HTMLElement>(".hand-ripple");
  keyboard = layer.querySelector<HTMLElement>(".hand-keyboard");
  caption = layer.querySelector<HTMLElement>(".hand-caption");
  drawKeyboard();
  place(at.x, at.y);
  hand!.style.opacity = "0";
}
function drawKeyboard() {
  if (!keyboard) return;
  const rows = KEYS.map(
    (keys) =>
      `<div class="hand-keyboard-row">${[...keys]
        .map((key) => `<span class="hand-key" data-key="${key}">${key}</span>`)
        .join("")}</div>`,
  ).join("");
  keyboard.innerHTML = `${rows}<div class="hand-keyboard-row"><span class="hand-key wide" data-key="ime">输入</span><span class="hand-key wide" data-key=" ">空格</span><span class="hand-key wide" data-key="enter">回车</span></div>`;
}
function place(x: number, y: number) {
  at = { x, y };
  if (hand) hand.style.transform = `translate(${x}px, ${y}px)`;
  if (caption && !caption.hidden) placeCaption();
}
/** 讲稿跟在手边：默认右下，碰到视口边缘就翻到另一侧。 */
function placeCaption() {
  if (!caption || !layer) return;
  const card = caption.getBoundingClientRect();
  const right = at.x + card.width + 60 > innerWidth;
  const below = at.y + card.height + 48 > innerHeight;
  caption.style.left = `${right ? Math.max(12, at.x - card.width - 18) : at.x + 26}px`;
  caption.style.top = `${below ? Math.max(12, at.y - card.height - 14) : at.y + 26}px`;
}

// ---------------------------------------------------------------- 动作
function targetPoint(target?: string, x?: number, y?: number): Point | null {
  if (target) {
    const element = document.querySelector(target);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return x === undefined || y === undefined ? null : { x, y };
}
/** 目标不在视野里就先滚进来（手是浮层，跟着页面滚动没问题）。 */
async function resolvePoint(
  target?: string,
  x?: number,
  y?: number,
): Promise<Point | null> {
  if (!target) return x === undefined || y === undefined ? null : { x, y };
  const element = document.querySelector(target);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const outside =
    rect.top < 12 ||
    rect.bottom > innerHeight - 12 ||
    rect.left < 12 ||
    rect.right > innerWidth - 12;
  if (outside) {
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
    await wait(reduced ? 0 : 450);
  }
  const settled = element.getBoundingClientRect();
  return {
    x: settled.left + settled.width / 2,
    y: settled.top + settled.height / 2,
  };
}
function animate(keyframes: Keyframe[], options_: KeyframeAnimationOptions) {
  if (!hand || reduced) return Promise.resolve();
  return hand.animate(keyframes, options_).finished.catch(() => undefined);
}
/** 位移：沿一条带轻微过冲的贝塞尔路径走，落点前收一下，看起来像手而不是补间。 */
async function moveTo(point: Point, ms?: number) {
  build();
  const distance = Math.hypot(point.x - at.x, point.y - at.y);
  const duration = reduced
    ? 0
    : (ms ?? Math.min(900, Math.max(280, distance * 0.9)));
  handSound("move");
  const from = { ...at };
  // 控制点：垂直于行进方向偏一点，终点略微过冲，收尾再回位。
  const nx = -(point.y - from.y);
  const ny = point.x - from.x;
  const length = Math.max(1, Math.hypot(nx, ny));
  const bow = Math.min(120, distance * 0.22);
  const cx = (from.x + point.x) / 2 + (nx / length) * bow;
  const cy = (from.y + point.y) / 2 + (ny / length) * bow;
  const frames: Keyframe[] = [];
  const steps = reduced ? 1 : 14;
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    const u = 1 - t;
    const x = u * u * from.x + 2 * u * t * cx + t * t * point.x;
    const y = u * u * from.y + 2 * u * t * cy + t * t * point.y;
    const overshoot =
      index === steps ? 1 : t < 0.85 ? 1 : 1.03 - (t - 0.85) * 0.2;
    frames.push({
      offset: t,
      transform: `translate(${x + (point.x - x) * (overshoot - 1)}px, ${y + (point.y - y) * (overshoot - 1)}px)`,
      easing: index === 0 ? "cubic-bezier(0.33, 0, 0.2, 1)" : undefined,
    });
  }
  at = { x: point.x, y: point.y };
  caption && !caption.hidden && placeCaption();
  await animate(frames, { duration, fill: "forwards" });
  hand!.style.transform = `translate(${point.x}px, ${point.y}px)`;
  if (caption && !caption.hidden) placeCaption();
}
async function pressAndClick(point: Point, target?: string, real = true) {
  build();
  await moveTo(point);
  if (ripple) {
    ripple.style.left = `${point.x}px`;
    ripple.style.top = `${point.y}px`;
    ripple.classList.remove("on");
    void ripple.offsetWidth;
    ripple.classList.add("on");
  }
  handSound("click");
  await animate(
    [
      { transform: `translate(${point.x}px, ${point.y}px) scale(1)` },
      { transform: `translate(${point.x}px, ${point.y + 3}px) scale(0.86)` },
      { transform: `translate(${point.x}px, ${point.y}px) scale(1)` },
    ],
    { duration: reduced ? 0 : 220, easing: "ease-out", fill: "forwards" },
  );
  hand!.style.transform = `translate(${point.x}px, ${point.y}px)`;
  if (real) {
    const element = target
      ? document.querySelector(target)
      : document.elementFromPoint(point.x, point.y);
    element?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
      }),
    );
  }
}
function keyElement(label: string) {
  return (
    keyboard?.querySelector<HTMLElement>(`[data-key="${CSS.escape(label)}"]`) ??
    null
  );
}
function flashKey(label: string) {
  // 中文这类没有键帽的字符走「输入」键：真机上那是输入法在替你打字。
  const key = keyElement(label) ?? keyElement("ime");
  if (!key) return;
  key.classList.add("down");
  setTimeout(() => key.classList.remove("down"), 120);
  if (/[A-Z]/.test(label)) {
    const shift = keyElement("shift");
    if (shift) {
      shift.classList.add("down");
      setTimeout(() => shift.classList.remove("down"), 150);
    }
  }
}
async function setKeyboard(on: boolean) {
  build();
  if (!keyboard) return;
  if (on) {
    keyboard.hidden = false;
    await wait(20);
    keyboard.classList.add("on");
  } else {
    keyboard.classList.remove("on");
    await wait(reduced ? 0 : 220);
    keyboard.hidden = true;
  }
}
function field(target: string) {
  const element = document.querySelector<
    HTMLInputElement | HTMLTextAreaElement
  >(target);
  if (!element) return null;
  return element;
}
async function typeInto(target: string, text: string, cps?: number) {
  build();
  const input = field(target);
  const point = await resolvePoint(target);
  if (point) await pressAndClick(point, undefined, false);
  input?.focus();
  await setKeyboard(true);
  const delay = reduced ? 0 : Math.max(30, 1000 / (cps ?? 11));
  for (const character of text) {
    const label = character === " " ? " " : character.toLowerCase();
    flashKey(label);
    handSound("key", label);
    // 应用每次输入都可能重绘：每敲一个字符重新取一次元素，否则后面的字写进
    // 已经脱离文档的旧节点里，看起来像「打了一半就停了」。
    const live = field(target) ?? input;
    if (live && live !== input) live.focus();
    if (live) {
      const setter = Object.getOwnPropertyDescriptor(
        live instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(live, live.value + character);
      live.dispatchEvent(new Event("input", { bubbles: true }));
    }
    // 手在小键盘上跳一下：字打得越快，跳动越轻。
    if (!reduced && keyboard) {
      const key = keyElement(label);
      if (key) {
        const box = key.getBoundingClientRect();
        await moveTo(
          { x: box.left + box.width / 2, y: box.top + box.height / 2 },
          Math.min(220, delay * 1.4),
        );
        handSound("key", label);
      }
    }
    await wait(delay);
  }
  await setKeyboard(false);
}

// ---------------------------------------------------------------- 讲稿
async function say(lines: string | string[], hold = false) {
  build();
  if (!caption) return;
  const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  caption.hidden = false;
  caption.classList.add("on");
  placeCaption();
  for (const [index, line] of list.entries()) {
    handSound("line");
    caption.innerHTML = `<p><span class="hand-caption-text"></span><i class="hand-caret"></i></p>${
      list.length > 1
        ? `<span class="hand-caption-step">${index + 1}/${list.length}</span>`
        : ""
    }`;
    placeCaption();
    const text = caption.querySelector<HTMLElement>(".hand-caption-text")!;
    for (const character of line) {
      text.textContent += character;
      if (!reduced) await wait(line.length > 24 ? 16 : 24);
    }
    const rest = reduced ? 0 : Math.max(900, line.length * 60);
    if (index < list.length - 1 || hold) await wait(rest);
  }
  // `hold` 的那一行留在屏幕上，后面的动作（打字、点击）在它旁边发生。
  if (hold) return;
  caption.classList.remove("on");
  await wait(reduced ? 0 : 260);
  caption.hidden = true;
}
async function highlight(target: string, ms = 1200) {
  const element = document.querySelector<HTMLElement>(target);
  if (!element) return;
  element.classList.add("hand-spotlight");
  await wait(ms);
  element.classList.remove("hand-spotlight");
}
async function apply(step: HandStep) {
  switch (step.kind) {
    case "move":
      await moveTo(
        (await resolvePoint(step.target, step.x, step.y)) ?? at,
        step.ms,
      );
      break;
    case "click":
      await pressAndClick(
        (await resolvePoint(step.target, step.x, step.y)) ?? at,
        step.target,
        step.real ?? true,
      );
      break;
    case "type":
      await typeInto(step.target, step.text, step.cps);
      break;
    case "highlight":
      await highlight(step.target, step.ms);
      break;
    case "say":
      await say(step.lines, step.hold);
      break;
    case "keyboard":
      await setKeyboard(step.on);
      break;
    case "wait":
      await wait(pace(step.ms));
      break;
    case "hide":
      await hideHand();
      break;
  }
}

// ---------------------------------------------------------------- 对外
export function showHand(label = "助手") {
  build();
  const plate = layer!.querySelector<HTMLElement>(".hand-label");
  if (plate) plate.textContent = label;
  hand!.style.opacity = "1";
  hand!.classList.add("on");
  if (!at.x && !at.y) {
    at = { x: innerWidth * 0.62, y: innerHeight * 0.42 };
    place(at.x, at.y);
  }
}
export async function hideHand() {
  if (!layer) return;
  await setKeyboard(false);
  caption?.classList.remove("on");
  if (caption) caption.hidden = true;
  hand?.classList.remove("on");
  if (hand) hand.style.opacity = "0";
}
/** 演一段脚本；同一时间只有一段，后来的排在后面。 */
export function runHandScript(
  next: HandScript,
  optionOverrides: HandOptions = {},
) {
  options = { ...options, ...optionOverrides };
  script = script.then(async () => {
    // 锁机或沉浸计时占着屏幕时不出手：那是用户明确说了「别打扰」的状态。
    if (options.suppressed?.()) return;
    showHand(next.label ?? "助手");
    if (next.accent) layer?.style.setProperty("--hand-accent", next.accent);
    await wait(180);
    for (const step of next.steps) await apply(step);
  });
  return script;
}
/** 一步一动，方便助手边做边说，或者外部按需驱动。 */
export function handStep(step: HandStep, optionOverrides: HandOptions = {}) {
  options = { ...options, ...optionOverrides };
  script = script.then(() => {
    if (options.suppressed?.()) return;
    return apply(step);
  });
  return script;
}
export function handPosition() {
  return { ...at };
}
/** 设置默认选项（音效来源等），后续 run/step 自动继承。 */
export function handOptions(next: HandOptions = {}) {
  options = { ...options, ...next };
}
