// Ofrenda — text work that must be predictable.
// Transcription cleanup, sentence splitting, and choosing the line that will
// carry the card. A 1B model writes prose; it does not decide which sentence a
// family will want on their wall. That is scoring, and scoring is code.

const SENSORY =
  /\b(smell|smelled|smelt|taste|tasted|hear|heard|voice|hands?|kitchen|song|sang|sing|hum|humming|bread|dough|laughter|laughed|garden|rain|window|letter|letters|photo|photograph|music|dance|danced|prayer|candle|marigold|coffee|tea|soup|blanket|porch|radio)\b/gi;

const GRIEF = /\b(passed|died|death|funeral|burial|hospital|cancer|sick|illness|buried|cemetery)\b/i;

const FIRST_PERSON = /\b(I|my|me|mine|we|our|us)\b/;

const ABBREVIATION = /\b(mr|mrs|ms|dr|prof|st|jr|sr|vs|etc|e\.g|i\.e|no)\.$/i;

/** Collapse whitespace, tidy punctuation, capitalise the first letter. */
export function cleanTranscript(raw) {
  let text = String(raw ?? '')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=\S)/g, '$1 ')
    .replace(/([.!?])\1+/g, '$1')
    .trim();

  if (!text) return '';
  text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Split into sentences without breaking on "Dr." or "e.g.".
 * Deliberately simple: spoken transcripts rarely contain the hard cases, and a
 * wrong split only costs a slightly odd quote candidate.
 */
export function splitSentences(text) {
  const cleaned = cleanTranscript(text);
  if (!cleaned) return [];

  const rough = cleaned.split(/(?<=[.!?])\s+/);
  const sentences = [];

  for (const piece of rough) {
    const previous = sentences[sentences.length - 1];
    if (previous && ABBREVIATION.test(previous)) {
      sentences[sentences.length - 1] = `${previous} ${piece}`;
    } else if (piece.trim()) {
      sentences.push(piece.trim());
    }
  }

  return sentences.filter((s) => s.length > 0);
}

export function wordCount(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Score every sentence as a candidate for the card's quote.
 * The goal is a line that sounds like the person, not a summary of the loss:
 * first person, sensory detail, a comfortable length, and no funeral language.
 */
export function quoteCandidates(sentences) {
  return sentences
    .map((text, index) => {
      const words = wordCount(text);
      const reasons = [];
      let score = 0;

      if (FIRST_PERSON.test(text)) {
        score += 4;
        reasons.push('sounds like them');
      }
      const sensoryHits = (text.match(SENSORY) || []).length;
      if (sensoryHits > 0) {
        score += Math.min(3, sensoryHits);
        reasons.push(sensoryHits > 1 ? `${sensoryHits} sensory details` : 'sensory detail');
      }
      if (words >= 8 && words <= 28) {
        score += 2;
        reasons.push('good length');
      } else if (words < 5) {
        score -= 4;
        reasons.push('too short');
      } else if (words > 40) {
        score -= 2;
        reasons.push('too long');
      }
      if (GRIEF.test(text)) {
        score -= 4;
        reasons.push('grief, not memory');
      }
      if (/\b(never|always)\b/i.test(text)) {
        score += 1;
        reasons.push('absolute');
      }

      return { text, index, score, reasons, words };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

/** The best line, or the first sentence, or ''. */
export function pickQuote(sentences) {
  const ranked = quoteCandidates(sentences);
  return ranked.length ? ranked[0].text : '';
}

/** "1938 – 2019", "b. 1938", "d. 2019", or ''. */
export function formatYears(from, to) {
  const start = String(from ?? '').trim();
  const end = String(to ?? '').trim();
  if (start && end) return `${start} – ${end}`;
  if (start) return `b. ${start}`;
  if (end) return `d. ${end}`;
  return '';
}

/** Used for the fallback title only; the model's title is validated instead. */
export function titleCase(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_, space, letter) => space + letter.toUpperCase())
    .trim();
}

/** Cut at a word boundary for card footers and shelf labels. */
export function ellipsize(text, maxChars) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, Math.max(0, maxChars - 1));
  const lastSpace = cut.lastIndexOf(' ');
  const kept = lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}
