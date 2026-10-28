// Ofrenda — the geometry of the card.
// Everything about where a line sits is computed here, with no canvas and no
// DOM, so the layout can be tested and the renderer stays a dumb painter.

import { ellipsize } from './text.js';

export const CARD = { width: 1200, height: 1600, pad: 104 };

/**
 * Greedy word wrap with a hard line budget.
 * The last line gets an ellipsis when content did not fit, because a card that
 * silently loses the end of a sentence is worse than one that admits it.
 */
export function wrapText(text, maxChars, maxLines = Infinity) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (maxChars < 4) return [ellipsize(clean, Math.max(1, maxChars))];

  const words = clean.split(' ');
  const lines = [];
  let current = '';
  let consumed = 0;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      consumed += 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = '';
    }
    if (lines.length >= maxLines) break;

    if (word.length > maxChars) {
      lines.push(ellipsize(word, maxChars));
      consumed += 1;
      continue;
    }

    current = word;
    consumed += 1;
  }

  if (current && lines.length < maxLines) lines.push(current);

  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = ellipsize(`${lines[lines.length - 1]} …`, maxChars);
  }

  return lines.slice(0, maxLines);
}

/** Roughly how many characters of serif text fit in a given width. */
export function charsPerLine(width, size, ratio = 0.52) {
  return Math.max(6, Math.floor(width / (size * ratio)));
}

const COLORS = {
  ink: '#241a20',
  muted: '#6c5a52',
  marigold: '#b26a17',
  faint: '#8a7468',
};

/**
 * Lay out every block of the card.
 * The remembrance starts below the quote, so a long quote pushes it down
 * instead of colliding with it.
 */
export function layoutCard(fields = {}, options = {}) {
  const width = options.width ?? CARD.width;
  const height = options.height ?? CARD.height;
  const pad = options.pad ?? CARD.pad;
  const maxWidth = width - pad * 2;

  const title = String(fields.title ?? '').trim() || 'A Story Kept';
  const name = String(fields.name ?? '').trim() || 'A Memory';
  const years = String(fields.years ?? '').trim();
  const subtitle = String(fields.subtitle ?? '').trim();
  const quote = String(fields.quote ?? '').trim();
  const remembrance = String(fields.remembrance ?? '').trim();

  const nameSize = name.length > 26 ? 54 : name.length > 18 ? 68 : 84;
  const nameLines = wrapText(name, charsPerLine(maxWidth, nameSize, 0.56), 2);
  const titleLines = wrapText(title, charsPerLine(maxWidth - 80, 44, 0.5), 2);

  let y = 150;
  const blocks = [];

  blocks.push({
    id: 'label',
    x: width / 2,
    y,
    size: 22,
    font: 'sans',
    align: 'center',
    color: COLORS.marigold,
    letterSpacing: 10,
    lines: ['OFRENDA'],
    lineHeight: 28,
  });

  y += 92;
  blocks.push({
    id: 'title',
    x: width / 2,
    y,
    size: 44,
    font: 'serifItalic',
    align: 'center',
    color: COLORS.marigold,
    lines: titleLines,
    lineHeight: 54,
  });

  y += titleLines.length * 54 + 34;
  blocks.push({
    id: 'name',
    x: width / 2,
    y,
    size: nameSize,
    font: 'serifBold',
    align: 'center',
    color: COLORS.ink,
    lines: nameLines,
    lineHeight: Math.round(nameSize * 1.12),
  });

  y += nameLines.length * Math.round(nameSize * 1.12) + 18;

  if (years) {
    blocks.push({
      id: 'years',
      x: width / 2,
      y,
      size: 30,
      font: 'serif',
      align: 'center',
      color: COLORS.muted,
      letterSpacing: 6,
      lines: [years],
      lineHeight: 38,
    });
    y += 52;
  }

  if (subtitle) {
    const subtitleLines = wrapText(subtitle, charsPerLine(maxWidth - 60, 28, 0.5), 2);
    blocks.push({
      id: 'subtitle',
      x: width / 2,
      y,
      size: 28,
      font: 'serifItalic',
      align: 'center',
      color: COLORS.muted,
      lines: subtitleLines,
      lineHeight: 36,
    });
    y += subtitleLines.length * 36 + 10;
  }

  y += 26;
  blocks.push({
    id: 'divider',
    x: width / 2,
    y,
    size: 0,
    font: 'none',
    align: 'center',
    color: COLORS.marigold,
    lines: [],
    lineHeight: 0,
    width: 260,
  });

  y += 84;
  const dividerY = y;

  const quoteLines = wrapText(quote, charsPerLine(maxWidth - 120, 38, 0.5), 5);
  const bodySize = 28;
  const bodyLines = wrapText(remembrance, charsPerLine(maxWidth, bodySize, 0.5), 9);

  const quoteHeight = quoteLines.length * 54;
  const bodyHeight = bodyLines.length * 44;
  const gap = quoteLines.length && bodyLines.length ? 72 : 0;
  const groupHeight = quoteHeight + gap + bodyHeight;

  // The quote and the remembrance are one composition: centre the pair in the
  // space between the divider and the marigold, so a short memory does not
  // leave the bottom of the card hollow.
  const flowerY = height - 300;
  const spaceTop = dividerY + 84;
  const spaceBottom = flowerY - 70;
  const free = Math.max(0, spaceBottom - spaceTop - groupHeight);
  let cursor = spaceTop + Math.min(Math.round(free * 0.45), 140);

  if (quoteLines.length) {
    blocks.push({
      id: 'quote',
      x: width / 2,
      y: cursor,
      size: 38,
      font: 'serifItalic',
      align: 'center',
      color: COLORS.ink,
      lines: quoteLines,
      lineHeight: 54,
      maxWidth: maxWidth - 120,
    });
    cursor += quoteHeight + gap;
  }

  if (bodyLines.length) {
    blocks.push({
      id: 'body',
      x: width / 2,
      y: cursor,
      size: bodySize,
      font: 'serif',
      align: 'center',
      color: COLORS.muted,
      lines: bodyLines,
      lineHeight: 44,
      maxWidth,
    });
  }

  blocks.push({
    id: 'flower',
    x: width / 2,
    y: flowerY,
    size: 0,
    font: 'none',
    align: 'center',
    color: COLORS.marigold,
    lines: [],
    lineHeight: 0,
  });

  blocks.push({
    id: 'footer',
    x: width / 2,
    y: height - 108,
    size: 20,
    font: 'sans',
    align: 'center',
    color: COLORS.faint,
    lines: [String(fields.footer ?? '').trim()].filter(Boolean),
    lineHeight: 26,
  });

  return { width, height, pad, blocks };
}

/** True when every block is inside the paper. Used by the tests and the painter. */
export function fitsOnCard(layout) {
  return layout.blocks.every((block) => {
    const lastLineY = block.y + Math.max(0, block.lines.length - 1) * block.lineHeight;
    return block.y >= 0 && lastLineY <= layout.height && block.x >= 0 && block.x <= layout.width;
  });
}
