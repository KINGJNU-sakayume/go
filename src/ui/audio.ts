/** Tiny synthesized table sounds (no audio files): the "탁" of two cards slapped together. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A short wooden "탁": filtered noise burst with a fast decay. `strength` 0..1 scales it. */
export function playTak(strength = 1): void {
  const ac = audio();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * 0.09);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1700 + 500 * strength;
  band.Q.value = 1.4;
  const gain = ac.createGain();
  gain.gain.value = 0.35 + 0.35 * Math.min(1, strength);
  src.connect(band).connect(gain).connect(ac.destination);
  src.start();
}

/** A low drum hit for 족보 completions and stamps. */
export function playDrum(): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(55, ac.currentTime + 0.25);
  gain.gain.setValueAtTime(0.5, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.32);
}
