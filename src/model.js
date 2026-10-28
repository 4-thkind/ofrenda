// Ofrenda — the writer.
// Gemma 3 1B, quantised, running in this tab. It writes the two pieces of prose
// a card needs: a title and a remembrance. Everything it returns is checked by
// remembrance.js first, and there is always a deterministic fallback, because a
// small model is a collaborator and not an authority.

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@next';
import {
  validateRemembrance,
  fallbackRemembrance,
  validateTitle,
  fallbackTitle,
} from './remembrance.js';
import { ellipsize } from './text.js';

export const WRITER_MODEL = 'onnx-community/gemma-3-1b-it-ONNX';
const MAX_PROMPT_CHARS = 1500;

let writer = null;
let device = 'not loaded';

export function writerStatus() {
  return { loaded: Boolean(writer), device };
}

export async function loadWriter(onProgress = () => {}) {
  const hasGPU = Boolean(navigator.gpu);

  const options = (useGpu) => ({
    dtype: 'q4',
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
    writer = await pipeline('text-generation', WRITER_MODEL, options(hasGPU));
    device = hasGPU ? 'WebGPU' : 'WASM (CPU)';
  } catch (error) {
    writer = await pipeline('text-generation', WRITER_MODEL, options(false));
    device = 'WASM (CPU)';
  }
  return device;
}

/**
 * One chat completion, normalised across the two shapes the library can return:
 * a plain string, or a message array.
 */
async function complete(messages, maxNewTokens) {
  const output = await writer(messages, {
    max_new_tokens: maxNewTokens,
    do_sample: true,
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.1,
  });

  const first = Array.isArray(output) ? output[0] : output;
  let text = first?.generated_text ?? '';
  if (Array.isArray(text)) text = text[text.length - 1]?.content ?? '';
  return String(text).trim();
}

/** A title must be one line; the model sometimes adds a second thought. */
function firstLine(text) {
  return (
    String(text ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)[0] ?? ''
  );
}

function memoryForPrompt(transcript) {
  return ellipsize(String(transcript ?? '').replace(/\s+/g, ' ').trim(), MAX_PROMPT_CHARS);
}

/** Two to five concrete words, or the deterministic title. */
export async function writeTitle({ transcript, name, relationship } = {}, onProgress = () => {}) {
  if (!writer) throw new Error('The writer is not loaded yet.');
  onProgress({ phase: 'naming' });

  const person = [name, relationship].filter(Boolean).join(', ');
  const messages = [
    {
      role: 'system',
      content:
        'You are Ofrenda, a quiet writer for a family memory card. You write short, concrete titles. You never explain yourself and you never repeat the instructions.',
    },
    {
      role: 'user',
      content: [
        'Write a title of three to five words for the memory below.',
        'Name the feeling with one concrete image from it. No quotation marks. No punctuation at the end.',
        'For example: The Bread She Never Measured.',
        'Reply with the title only.',
        '',
        person ? `Person: ${person}.` : '',
        `Memory: ${memoryForPrompt(transcript)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  let raw = '';
  try {
    raw = firstLine(await complete(messages, 24)).replace(/^title\s*[:\-–—]\s*/i, '');
  } catch (error) {
    console.warn('Ofrenda: title generation failed', error);
    raw = '';
  }
  window.__ofrendaDebug = { ...(window.__ofrendaDebug || {}), titleRaw: raw };

  const accepted = validateTitle(raw);
  return accepted
    ? { text: accepted, source: 'gemma' }
    : { text: fallbackTitle({ quote: transcript }), source: 'fallback' };
}

/** Three sentences, validated; otherwise the written fallback. */
export async function writeRemembrance(
  { transcript, name, relationship, place, quote } = {},
  onProgress = () => {}
) {
  if (!writer) throw new Error('The writer is not loaded yet.');
  onProgress({ phase: 'writing' });

  const person = [name, relationship].filter(Boolean).join(', ') || 'someone in this family';
  const messages = [
    {
      role: 'system',
      content:
        'You are Ofrenda, a quiet writer for a family memory card. You write plainly and warmly, in exactly three sentences, using only details that appear in the memory. You never invent quotations or events. You never explain yourself.',
    },
    {
      role: 'user',
      content: [
        'Write exactly three sentences remembering the person in the memory below.',
        'Use only details from the memory. Under seventy words. Do not quote anyone.',
        'Do not use the phrases "loving memory", "rest in peace", "forever in our hearts" or "gone but not forgotten".',
        'No headings, no lists, no markdown.',
        '',
        `Person: ${person}.${place ? ` Place: ${place}.` : ''}`,
        `Memory: ${memoryForPrompt(transcript)}`,
      ].join('\n'),
    },
  ];

  let raw = '';
  try {
    raw = await complete(messages, 160);
  } catch (error) {
    console.warn('Ofrenda: remembrance generation failed', error);
    raw = '';
  }
  window.__ofrendaDebug = { ...(window.__ofrendaDebug || {}), remembranceRaw: raw };

  const accepted = validateRemembrance(raw);
  return accepted
    ? { text: accepted, source: 'gemma' }
    : { text: fallbackRemembrance({ name, relationship, place }), source: 'fallback' };
}
