/**
 * Lightweight procedural SFX via Web Audio API (no asset files).
 * Volume 0–1 from localStorage ff_volume (0–100).
 */

type SfxName =
  | "shoot"
  | "reload"
  | "buy"
  | "ui"
  | "foot"
  | "hit"
  | "kill"
  | "deny";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function volume(): number {
  try {
    const v = Number(localStorage.getItem("ff_volume") ?? "70");
    if (!Number.isFinite(v)) return 0.7;
    return Math.max(0, Math.min(1, v / 100));
  } catch {
    return 0.7;
  }
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType,
  gainMul: number,
  freqEnd?: number,
) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + dur);
  }
  const v = volume() * gainMul;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Noise burst for gunshot body */
function noiseBurst(dur: number, gainMul: number) {
  const c = getCtx();
  if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  const t0 = c.currentTime;
  const v = volume() * gainMul;
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
}

export const Sfx = {
  resume() {
    const c = getCtx();
    if (c?.state === "suspended") void c.resume();
  },

  play(name: SfxName) {
    this.resume();
    switch (name) {
      case "shoot":
        noiseBurst(0.08, 0.45);
        beep(180, 0.06, "square", 0.12, 60);
        break;
      case "reload":
        beep(220, 0.05, "triangle", 0.15);
        setTimeout(() => beep(320, 0.07, "triangle", 0.12), 80);
        break;
      case "buy":
        beep(520, 0.08, "sine", 0.18);
        setTimeout(() => beep(780, 0.1, "sine", 0.14), 70);
        break;
      case "ui":
        beep(440, 0.04, "sine", 0.1);
        break;
      case "deny":
        beep(160, 0.12, "sawtooth", 0.12, 90);
        break;
      case "hit":
        beep(90, 0.05, "square", 0.1);
        noiseBurst(0.04, 0.2);
        break;
      case "kill":
        // Dry kill confirm — short high tick + soft body thud
        beep(880, 0.04, "square", 0.14, 620);
        noiseBurst(0.035, 0.12);
        setTimeout(() => beep(220, 0.06, "triangle", 0.08, 120), 30);
        break;
      case "foot":
        beep(80 + Math.random() * 20, 0.03, "triangle", 0.04);
        break;
      default:
        break;
    }
  },
};
