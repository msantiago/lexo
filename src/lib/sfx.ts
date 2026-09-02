let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let htmlReady = false;
const html: Partial<Record<"score" | "scoreBig" | "scoreEpic" | "fail" | "stolen", HTMLAudioElement>> =
  {};

const isIOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const canVibrate = !isIOS && typeof navigator !== "undefined" && "vibrate" in navigator;

function AudioCtor(): typeof AudioContext | null {
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function context(): AudioContext | null {
  const Ctor = AudioCtor();
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
    master = audioCtx.createGain();
    master.gain.value = 0.32;
    master.connect(audioCtx.destination);
  }
  return audioCtx;
}

function env(t: number, dur: number, attack = 0.012) {
  if (t < 0 || t > dur) return 0;
  if (t < attack) return t / attack;
  const fall = 1 - (t - attack) / Math.max(0.001, dur - attack);
  return Math.max(0, fall * fall);
}

function samples(
  seconds: number,
  notes: { freq: number; start: number; dur: number; gain: number; slide?: number }[],
  sampleRate = 22050,
) {
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (const note of notes) {
      const u = t - note.start;
      if (u < 0 || u > note.dur) continue;
      const freq = note.slide
        ? note.freq * Math.pow(note.slide / note.freq, u / note.dur)
        : note.freq;
      const a = env(u, note.dur) * note.gain;
      s += Math.sin(2 * Math.PI * freq * u) * a;
    }
    out[i] = Math.max(-1, Math.min(1, s));
  }
  return out;
}

function wavUrl(pcm: Float32Array, sampleRate = 22050) {
  const bytes = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

const WAV = {
  silent: wavUrl(samples(0.05, [{ freq: 440, start: 0, dur: 0.04, gain: 0.0001 }])),
  score: wavUrl(
    samples(0.5, [
      { freq: 523.25, start: 0, dur: 0.32, gain: 0.45 },
      { freq: 783.99, start: 0.08, dur: 0.38, gain: 0.36 },
    ]),
  ),
  scoreBig: wavUrl(
    samples(0.62, [
      { freq: 392, start: 0, dur: 0.32, gain: 0.38 },
      { freq: 523.25, start: 0.09, dur: 0.36, gain: 0.4 },
      { freq: 659.25, start: 0.18, dur: 0.42, gain: 0.36 },
    ]),
  ),
  scoreEpic: wavUrl(
    samples(0.82, [
      { freq: 523.25, start: 0, dur: 0.35, gain: 0.36 },
      { freq: 659.25, start: 0.1, dur: 0.38, gain: 0.38 },
      { freq: 783.99, start: 0.2, dur: 0.42, gain: 0.36 },
      { freq: 1046.5, start: 0.32, dur: 0.48, gain: 0.34 },
    ]),
  ),
  fail: wavUrl(
    samples(0.38, [
      { freq: 280, start: 0, dur: 0.28, gain: 0.42, slide: 118 },
      { freq: 196, start: 0.07, dur: 0.22, gain: 0.26 },
    ]),
  ),
  stolen: wavUrl(
    samples(0.46, [
      { freq: 392, start: 0, dur: 0.22, gain: 0.34 },
      { freq: 311.13, start: 0.11, dur: 0.34, gain: 0.36, slide: 246.94 },
    ]),
  ),
};

function makeHtml(src: string) {
  const el = new Audio(src);
  el.preload = "auto";
  el.playsInline = true;
  el.setAttribute("playsinline", "true");
  return el;
}

function warmHtml() {
  if (htmlReady) return;
  html.score = makeHtml(WAV.score);
  html.scoreBig = makeHtml(WAV.scoreBig);
  html.scoreEpic = makeHtml(WAV.scoreEpic);
  html.fail = makeHtml(WAV.fail);
  html.stolen = makeHtml(WAV.stolen);
  const silent = makeHtml(WAV.silent);
  silent.volume = 0.01;
  const play = silent.play();
  if (play) {
    void play
      .then(() => {
        silent.pause();
        htmlReady = true;
      })
      .catch(() => {
        htmlReady = false;
      });
  } else {
    htmlReady = true;
  }
}

function playHtml(name: keyof typeof html) {
  const el = html[name];
  if (!el) return;
  try {
    el.currentTime = 0;
    const play = el.play();
    if (play) void play.catch(() => {});
  } catch {
    /* ignore */
  }
}

function playOsc(
  freq: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine",
  slideTo?: number,
) {
  const ctx = audioCtx;
  if (!ctx || !master || ctx.state !== "running") return;
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, ctx.currentTime + duration);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch {
    /* ignore */
  }
}

function haptic(pattern: number | number[]) {
  if (!canVibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export function hapticSuccess(shared = false) {
  haptic(shared ? 20 : 12);
}

export function hapticFail() {
  haptic(40);
}

export function playScoreSound(letters: number) {
  const name = letters >= 7 ? "scoreEpic" : letters >= 6 ? "scoreBig" : "score";
  if (html[name]) {
    playHtml(name);
    return;
  }
  if (letters >= 7) {
    playOsc(523.25, 0.28, 0.22);
    playOsc(783.99, 0.32, 0.18);
    playOsc(1046.5, 0.36, 0.16);
  } else if (letters >= 6) {
    playOsc(392, 0.24, 0.2);
    playOsc(659.25, 0.3, 0.18);
  } else {
    playOsc(523.25, 0.22, 0.2);
    playOsc(783.99, 0.26, 0.16);
  }
}

export function playFailSound() {
  if (html.fail) {
    playHtml("fail");
    return;
  }
  playOsc(280, 0.28, 0.22, "triangle", 118);
}

export function playStolenSound() {
  if (html.stolen) {
    playHtml("stolen");
    return;
  }
  playOsc(311.13, 0.3, 0.18, "triangle", 246.94);
}

export function playLetterSelect(step: number) {
  haptic(8 + Math.min(Math.max(step, 1), 8));
  const n = Math.max(1, step);
  playOsc(640 * Math.pow(1.05, Math.min(n - 1, 10)), 0.038, 0.12, "triangle");
}

export function playLetterBack() {
  haptic(6);
}

export function unlockAudio() {
  try {
    warmHtml();
    const ctx = context();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
}

export function installAudioUnlock() {
  const onClick = () => unlockAudio();
  window.addEventListener("click", onClick, true);
  return () => window.removeEventListener("click", onClick, true);
}
