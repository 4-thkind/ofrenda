// Ofrenda — the painter.
// The layout is decided in card-layout.js; this file only puts ink on paper.
// A canvas keeps the keepsake portable: one PNG, no dependencies, printable at
// 4x6 inches and readable on a phone.

import { layoutCard } from './card-layout.js';

const FONTS = {
  serif: (size) => `${size}px Georgia, "Times New Roman", serif`,
  serifBold: (size) => `bold ${size}px Georgia, "Times New Roman", serif`,
  serifItalic: (size) => `italic ${size}px Georgia, "Times New Roman", serif`,
  sans: (size) => `600 ${size}px "Segoe UI", system-ui, sans-serif`,
};

const INK = {
  paperTop: '#fbf3e2',
  paperMid: '#f6ecd6',
  paperBottom: '#f0e2c6',
  marigold: '#c9761b',
  terracotta: '#a63f2c',
  plum: '#6d3b63',
};

/** Seeded noise so the paper looks like paper, and every render is identical. */
function paper(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, INK.paperTop);
  gradient.addColorStop(0.55, INK.paperMid);
  gradient.addColorStop(1, INK.paperBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 0; i < 1800; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = 0.2 + random() * 1.3;
    ctx.fillStyle = `rgba(122, 92, 58, ${0.015 + random() * 0.03})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  vignette.addColorStop(0, 'rgba(80, 52, 30, 0)');
  vignette.addColorStop(1, 'rgba(80, 52, 30, 0.10)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/** Papel picado: the cut-paper banners that hang over an ofrenda. */
function papelPicado(ctx, width, top, direction) {
  const margin = 46;
  const height = 26;
  const step = 46;
  const colours = [INK.marigold, INK.terracotta, INK.plum];

  let index = 0;
  for (let x = margin + 4; x + step - 8 < width - margin; x += step) {
    ctx.fillStyle = colours[index % colours.length];
    ctx.beginPath();
    if (direction === 'down') {
      ctx.moveTo(x, top);
      ctx.lineTo(x + step - 8, top);
      ctx.lineTo(x + (step - 8) / 2, top + height);
    } else {
      ctx.moveTo(x, top);
      ctx.lineTo(x + step - 8, top);
      ctx.lineTo(x + (step - 8) / 2, top - height);
    }
    ctx.closePath();
    ctx.fill();
    index += 1;
  }
}

function frame(ctx, width, height) {
  const margin = 46;
  ctx.strokeStyle = INK.marigold;
  ctx.lineWidth = 3;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  papelPicado(ctx, width, margin + 10, 'down');
  papelPicado(ctx, width, height - margin - 10, 'up');
}

function divider(ctx, block) {
  const half = block.width / 2;
  ctx.strokeStyle = INK.marigold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(block.x - half, block.y);
  ctx.lineTo(block.x - 16, block.y);
  ctx.moveTo(block.x + 16, block.y);
  ctx.lineTo(block.x + half, block.y);
  ctx.stroke();

  ctx.fillStyle = INK.marigold;
  ctx.beginPath();
  ctx.moveTo(block.x, block.y - 7);
  ctx.lineTo(block.x + 7, block.y);
  ctx.lineTo(block.x, block.y + 7);
  ctx.lineTo(block.x - 7, block.y);
  ctx.closePath();
  ctx.fill();
}

function marigold(ctx, block) {
  const petals = 8;
  ctx.save();
  ctx.translate(block.x, block.y);
  for (let i = 0; i < petals; i += 1) {
    ctx.rotate((Math.PI * 2) / petals);
    ctx.fillStyle = i % 2 ? 'rgba(201, 118, 27, 0.62)' : 'rgba(166, 63, 44, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, -30, 13, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#c9761b';
  ctx.beginPath();
  ctx.arc(block.x, block.y, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 236, 200, 0.6)';
  ctx.beginPath();
  ctx.arc(block.x - 3, block.y - 3, 4, 0, Math.PI * 2);
  ctx.fill();
}

function blocks(ctx, layout) {
  for (const block of layout.blocks) {
    if (block.id === 'divider') {
      divider(ctx, block);
      continue;
    }
    if (block.id === 'flower') {
      marigold(ctx, block);
      continue;
    }
    if (!block.lines || !block.lines.length) continue;

    ctx.font = FONTS[block.font](block.size);
    ctx.fillStyle = block.color;
    ctx.textAlign = block.align === 'center' ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    if (block.letterSpacing) ctx.letterSpacing = `${block.letterSpacing}px`;

    block.lines.forEach((line, index) => {
      ctx.fillText(line, block.x, block.y + index * block.lineHeight);
    });

    if (block.letterSpacing) ctx.letterSpacing = '0px';
  }
}

/**
 * Paint a complete card and return the layout that was used.
 * The same fields always produce the same pixels.
 */
export function renderCard(canvas, fields, options = {}) {
  const width = options.width ?? canvas.width;
  const height = options.height ?? canvas.height;
  const layout = layoutCard(fields, { ...options, width, height });

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  paper(ctx, width, height);
  frame(ctx, width, height);
  blocks(ctx, layout);

  return layout;
}

/** PNG blob for the download button. */
export function cardToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The card could not be exported.'));
    }, 'image/png');
  });
}
