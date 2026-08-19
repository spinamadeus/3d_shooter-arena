let ctx;
let master;

function ensure() {
  if (ctx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
}

export function resumeAudio() {
  ensure();
  if (ctx.state === "suspended") ctx.resume();
}

function tone(freq, dur, type = "square", gain = 0.4, slide = 0) {
  ensure();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(dur, gain = 0.25) {
  ensure();
  const t = ctx.currentTime;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t);
}

export const sfx = {
  shoot() {
    tone(420, 0.07, "square", 0.18, -280);
    noiseBurst(0.06, 0.18);
  },
  hit() {
    tone(880, 0.05, "triangle", 0.22);
  },
  hurt() {
    tone(140, 0.18, "sawtooth", 0.28, -80);
  },
  kill() {
    tone(220, 0.12, "square", 0.25, 180);
    tone(440, 0.2, "triangle", 0.18, 220);
  },
  win() {
    tone(523, 0.18, "square", 0.2);
    setTimeout(() => tone(659, 0.18, "square", 0.2), 140);
    setTimeout(() => tone(784, 0.3, "square", 0.22), 280);
  },
  lose() {
    tone(196, 0.4, "sawtooth", 0.22, -120);
  },
};
