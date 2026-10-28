// Ofrenda — the listener.
// Whisper tiny.en, q8, running in this tab on WebGPU with a WASM fallback.
// It hears the story once; the audio never becomes a request.

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@next';

export const ASR_MODEL = 'onnx-community/whisper-tiny.en';

let asr = null;
let device = 'not loaded';

export function asrStatus() {
  return { loaded: Boolean(asr), device };
}

/**
 * Free the listener before the writer wakes up. Two models on one GPU is more
 * memory than some machines will give a tab, and a reload in the middle of a
 * story is unforgivable. The weights stay in the HTTP cache, so waking the
 * listener again takes seconds.
 */
export async function releaseASR() {
  if (!asr) return;
  try {
    if (typeof asr.dispose === 'function') await asr.dispose();
  } catch (error) {
    // A failed dispose is not worth failing the card over.
  }
  asr = null;
  device = 'not loaded';
}

export async function loadASR(onProgress = () => {}) {
  const hasGPU = Boolean(navigator.gpu);

  const options = (useGpu) => ({
    dtype: 'q8',
    device: useGpu ? 'webgpu' : 'wasm',
    progress_callback: (event) => {
      if (!event) return;
      if (event.status === 'progress' && event.file && event.file.endsWith('.onnx')) {
        onProgress({ phase: 'download', pct: Math.round(event.progress || 0) });
      } else if (event.status === 'ready') {
        onProgress({ phase: 'ready', pct: 100 });
      }
    },
  });

  try {
    asr = await pipeline('automatic-speech-recognition', ASR_MODEL, options(hasGPU));
    device = hasGPU ? 'WebGPU' : 'WASM (CPU)';
  } catch (error) {
    asr = await pipeline('automatic-speech-recognition', ASR_MODEL, options(false));
    device = 'WASM (CPU)';
  }
  return device;
}

/**
 * Transcribe 16 kHz mono samples. Long audio is chunked by the library itself;
 * we only ask for the text.
 */
export async function transcribe(samples, onProgress = () => {}) {
  if (!asr) throw new Error('The listener is not loaded yet.');
  onProgress({ phase: 'listening' });
  const output = await asr(samples, {
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  onProgress({ phase: 'heard' });
  return String(output?.text ?? '').trim();
}
