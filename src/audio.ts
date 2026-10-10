export type SoundCue =
  | "start"
  | "resume"
  | "pause"
  | "stop"
  | "focusEnd"
  | "breakEnd"
  | "breakStart"
  | "taskComplete"
  | "reminder"
  | "lockStart"
  | "lockEnd";

// Brief gestures for controls, longer bells only when attention should move
// to the next activity. No ticking during study.
type Note = [frequency: number, offset: number, duration: number];
const scores: Record<SoundCue, Note[]> = {
  start: [
    [392, 0, 0.18],
    [523.25, 0.1, 0.28],
  ],
  resume: [[523.25, 0, 0.22]],
  pause: [[392, 0, 0.2]],
  stop: [
    [392, 0, 0.16],
    [293.66, 0.09, 0.22],
  ],
  focusEnd: [
    [523.25, 0, 0.65],
    [659.25, 0.16, 0.65],
    [783.99, 0.32, 0.85],
  ],
  breakEnd: [
    [659.25, 0, 0.38],
    [783.99, 0.18, 0.55],
    [1046.5, 0.36, 0.6],
  ],
  breakStart: [
    [523.25, 0, 0.24],
    [392, 0.12, 0.4],
  ],
  taskComplete: [
    [659.25, 0, 0.26],
    [783.99, 0.1, 0.4],
  ],
  reminder: [
    [587.33, 0, 0.35],
    [783.99, 0.24, 0.45],
  ],
  lockStart: [
    [392, 0, 0.42],
    [329.63, 0.17, 0.5],
    [261.63, 0.34, 0.65],
  ],
  lockEnd: [
    [392, 0, 0.32],
    [523.25, 0.17, 0.5],
  ],
};

let context: AudioContext | null = null;
let noise: AudioBufferSourceNode | null = null;
let volume: GainNode | null = null;
const voices = new Map<OscillatorNode, GainNode>();

export function unlockAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Sound is optional: unavailable audio must never block a timer or task.
  }
}

export function stopSound() {
  // Fade interrupted bells instead of cutting a nonzero sample, which clicks.
  const at = context?.currentTime ?? 0;
  for (const [voice, gain] of voices) {
    if (typeof gain.gain.cancelAndHoldAtTime === "function")
      gain.gain.cancelAndHoldAtTime(at);
    else {
      const value = gain.gain.value;
      gain.gain.cancelScheduledValues(at);
      gain.gain.setValueAtTime(value, at);
    }
    gain.gain.setTargetAtTime(0, at, 0.005);
    voice.stop(at + 0.03);
  }
  voices.clear();
}

export function playSound(cue: SoundCue, level: number) {
  if (!Number.isFinite(level) || level <= 0) return;
  unlockAudio();
  // Don't queue blocked bells: they would all play at the next gesture.
  if (!context || context.state !== "running") return;
  stopSound();
  const ctx = context;
  const amplitude = (Math.min(level, 100) / 100) * 0.18;
  for (const [frequency, offset, duration] of scores[cue]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + 0.015 + offset;
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amplitude, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(
      amplitude * 0.001,
      start + duration - 0.025,
    );
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(gain).connect(ctx.destination);
    voices.set(osc, gain);
    osc.onended = () => {
      voices.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(start);
    osc.stop(start + duration);
  }
}
export function setNoise(kind: string, level = 0.2) {
  noise?.stop();
  noise = null;
  volume = null;
  if (kind === "off") return;
  unlockAudio();
  if (!context) return;
  const buffer = context!.createBuffer(
    1,
    context!.sampleRate * 4,
    context!.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = kind === "brown" ? last * 3.5 : white * 0.3;
  }
  noise = context!.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const filter = context!.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = kind === "rain" ? 1800 : 600;
  volume = context!.createGain();
  volume.gain.value = level;
  noise.connect(filter).connect(volume).connect(context!.destination);
  noise.start();
}
export function setNoiseVolume(level: number) {
  if (volume) volume.gain.value = level;
}
