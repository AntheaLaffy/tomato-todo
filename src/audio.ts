let context: AudioContext | null = null;
let noise: AudioBufferSourceNode | null = null;
let volume: GainNode | null = null;
export function unlockAudio() {
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
}
export function chime() {
  unlockAudio();
  [523.25, 659.25, 783.99].forEach((frequency, i) => {
    const osc = context!.createOscillator(),
      gain = context!.createGain(),
      start = context!.currentTime + i * 0.16;
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1);
    osc.connect(gain).connect(context!.destination);
    osc.start(start);
    osc.stop(start + 1);
  });
}
export function setNoise(kind: string, level = 0.2) {
  noise?.stop();
  noise = null;
  volume = null;
  if (kind === "off") return;
  unlockAudio();
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
