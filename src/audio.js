// Ofrenda — audio intake.
// The browser does the decoding and the downmix; this module owns the parts
// that can be reasoned about without a DOM: the size limits and the labels.

export const TARGET_RATE = 16000; // Whisper's native rate
export const MAX_SECONDS = 180; // three minutes is a story, not an archive

/**
 * Decode any browser-supported audio file into 16 kHz mono Float32 samples.
 * OfflineAudioContext does the resampling properly (with a low-pass), which is
 * why we do not hand-roll linear interpolation here.
 */
export async function decodeToMono16k(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('This browser cannot decode audio.');
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (!decoded || !decoded.duration) throw new Error('That file did not decode as audio.');

    const frames = Math.ceil(decoded.duration * TARGET_RATE);
    const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();

    return {
      samples: rendered.getChannelData(0),
      seconds: decoded.duration,
      originalRate: decoded.sampleRate,
      originalChannels: decoded.numberOfChannels,
    };
  } finally {
    if (ctx.close) await ctx.close();
  }
}

/** "2:07" for anything over a minute, "34s" under it. */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Guard used by the UI before it spends a minute of GPU time. */
export function withinLimit(seconds, limit = MAX_SECONDS) {
  return Number(seconds) > 0 && Number(seconds) <= limit;
}

/** Human sentence for the one thing that goes wrong at this step. */
export function lengthMessage(seconds, limit = MAX_SECONDS) {
  if (!(Number(seconds) > 0)) return 'That recording was empty.';
  return `That story is ${formatDuration(seconds)}. Keep it under ${formatDuration(limit)} — the point is one memory, told once.`;
}
