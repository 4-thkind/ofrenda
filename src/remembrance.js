// Ofrenda — what the model is allowed to say.
// A 1B model writes warm prose quite well and clichés extremely well. This
// module is the bouncer: it rejects markdown, greeting-card language, model
// apologies and anything the wrong length, and it can produce a written
// fallback that is still true to the facts.

import { ellipsize, wordCount } from './text.js';

export const CLICHES =
  /\b(loving memory|rest in peace|forever in our hearts|gone but not forgotten|never be forgotten|will be missed|angel|soulmate|dearly departed|at peace now)\b/i;

const MODEL_EXCUSES =
  /\b(as an ai|i cannot|i can't|language model|i'm sorry|circuits?|algorithm|neural network|artificial intelligence)\b/i;

// A remembrance may not put words in the person's mouth. If the model invents
// dialogue, the card falls back to facts rather than fiction.
const QUOTED_SPEECH = /["“”]/;

const MARKDOWN = /[*_#`>]|\n\s*[-–—]\s/;

/**
 * Accept the model's remembrance only if it reads like three honest sentences.
 * Returns the cleaned text, or null so the caller can use the fallback.
 */
export function validateRemembrance(text, { minWords = 18, maxWords = 95 } = {}) {
  let clean = String(text ?? '')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(remembrance|eulogy|memory)\s*[:\-–—]\s*/i, '')
    .trim();

  if (!clean) return null;
  if (MARKDOWN.test(clean)) return null;
  if (CLICHES.test(clean)) return null;
  if (MODEL_EXCUSES.test(clean)) return null;
  if (QUOTED_SPEECH.test(clean)) return null;

  const words = wordCount(clean);
  if (words < minWords || words > maxWords) return null;

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 2 || sentences.length > 4) return null;
  if (!/[.!?]$/.test(clean)) return null;

  return clean;
}

const VOWELS = /^[aeiou]/i;

function articleFor(word) {
  const clean = String(word ?? '').trim();
  if (!clean) return 'a';
  return VOWELS.test(clean) ? 'an' : 'a';
}

/**
 * The written fallback. It is not a consolation prize: it says exactly what
 * happened, which is often more than a small model manages.
 */
export function fallbackRemembrance({ name, relationship, place } = {}) {
  const subject = String(name ?? '').trim() || 'This memory';
  const rel = String(relationship ?? '').trim();

  const opener = rel
    ? `${subject}, ${articleFor(rel)} ${rel.toLowerCase()}, is remembered here.`
    : `${subject} is remembered here.`;

  const middle = String(place ?? '').trim()
    ? `The memory belongs to ${String(place).trim()}.`
    : 'The memory belongs to the telling.';

  const close =
    'It was spoken out loud once, kept on one machine, and it is still here.';

  return `${opener} ${middle} ${close}`;
}

/**
 * The card title is the one place a 1B model can be genuinely good: four words
 * that name the feeling. Anything longer, quoted, or apologetic is rejected.
 */
export function validateTitle(text, { maxWords = 6, maxChars = 46 } = {}) {
  const clean = String(text ?? '')
    .replace(/[*_#`"]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.:;,]+$/, '')
    .trim();

  if (!clean) return null;
  if (clean.length > maxChars) return null;
  if (/\b(title|here is|sure|certainly|okay|as an ai)\b/i.test(clean)) return null;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > maxWords) return null;
  if (!/[a-z]/i.test(clean)) return null;

  return clean;
}

const TITLE_HINTS = [
  [/bread|dough|bake|kitchen|soup|coffee|tea/i, 'What the Kitchen Kept'],
  [/garden|flower|marigold|rose|tree|plant/i, 'What the Garden Kept'],
  [/song|sing|sang|hum|music|dance/i, 'A Song Still Humming'],
  [/photo|photograph|picture|letter|letters/i, 'The Photograph Remembers'],
  [/car|drive|road|trip|train/i, 'The Long Way Home'],
  [/rain|storm|window|night/i, 'After the Rain'],
  [/hand|hands|held|hold/i, 'What Her Hands Knew'],
];

/** Deterministic title, chosen from the imagery the quote already contains. */
export function fallbackTitle({ quote } = {}) {
  const text = String(quote ?? '');
  for (const [pattern, title] of TITLE_HINTS) {
    if (pattern.test(text)) return title;
  }
  return 'A Story Kept';
}

/** Short label for the shelf card. */
export function dedicationLine({ relationship, place } = {}) {
  const rel = String(relationship ?? '').trim();
  const where = String(place ?? '').trim();
  if (rel && where) return `${rel} · ${where}`;
  if (rel) return rel;
  if (where) return where;
  return 'a memory kept';
}

export { ellipsize };
