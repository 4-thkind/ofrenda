// Ofrenda — the app.
// One page, three steps, two local models. The controller owns the order of
// operations; every judgement call (which sentence, how many words, what fits)
// lives in a tested module.

import { decodeToMono16k, formatDuration, withinLimit, lengthMessage } from './audio.js';
import {
  cleanTranscript,
  splitSentences,
  quoteCandidates,
  pickQuote,
  formatYears,
  ellipsize,
} from './text.js';
import { dedicationLine } from './remembrance.js';
import { renderCard, cardToBlob } from './card-render.js';
import { loadASR, transcribe, asrStatus, releaseASR } from './asr.js';
import { loadWriter, writeTitle, writeRemembrance, writerStatus } from './model.js';
import { loadShelf, saveMemory, removeMemory } from './store.js';

const $ = (id) => document.getElementById(id);

const els = {
  recordBtn: $('recordBtn'),
  stopBtn: $('stopBtn'),
  fileInput: $('fileInput'),
  sampleBtn: $('sampleBtn'),
  player: $('player'),
  audioMeta: $('audioMeta'),
  transcript: $('transcript'),
  name: $('name'),
  relationship: $('relationship'),
  born: $('born'),
  died: $('died'),
  place: $('place'),
  writeBtn: $('writeBtn'),
  quoteChips: $('quoteChips'),
  title: $('title'),
  remembrance: $('remembrance'),
  downloadBtn: $('downloadBtn'),
  keepBtn: $('keepBtn'),
  shelf: $('shelf'),
  shelfCount: $('shelfCount'),
  canvas: $('cardCanvas'),
  status: $('status'),
  bar: $('bar'),
  barFill: $('barFill'),
  asrBadge: $('asrBadge'),
  writerBadge: $('writerBadge'),
  panelWords: $('panel-words'),
  panelCard: $('panel-card'),
};

const state = {
  samples: null,
  seconds: 0,
  quote: '',
  busy: false,
  recording: false,
};

let playerUrl = null;

const PLACEHOLDER = {
  title: 'A Story Kept',
  name: 'Your story',
  subtitle: 'the card appears here',
  quote: 'Say it out loud once. The machine will listen, and the paper will remember.',
  remembrance: '',
  footer: 'nothing leaves this tab',
};

/* ---------- small UI helpers ---------- */

function setStatus(text, tone = '') {
  els.status.textContent = text;
  els.status.className = `status${tone ? ` ${tone}` : ''}`;
}

function setProgress(pct) {
  els.bar.hidden = false;
  els.barFill.style.width = `${Math.max(2, Math.min(100, pct))}%`;
}

function hideProgress() {
  els.bar.hidden = true;
  els.barFill.style.width = '0%';
}

function updateBadges() {
  const listener = asrStatus();
  const writer = writerStatus();
  els.asrBadge.textContent = listener.loaded ? `whisper · ${listener.device}` : 'whisper · asleep';
  els.writerBadge.textContent = writer.loaded ? `gemma · ${writer.device}` : 'gemma · asleep';
}

function setBusy(busy) {
  state.busy = busy;
  for (const button of [els.recordBtn, els.sampleBtn, els.writeBtn, els.downloadBtn, els.keepBtn]) {
    button.disabled = busy;
  }
}

function slugify(text) {
  return (
    String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'memory'
  );
}

/* ---------- card ---------- */

function readFields() {
  const born = els.born.value.trim();
  const died = els.died.value.trim();
  const relationship = els.relationship.value.trim();
  const place = els.place.value.trim();

  return {
    name: els.name.value.trim(),
    relationship,
    place,
    years: formatYears(born, died),
    subtitle: dedicationLine({ relationship, place }),
    title: els.title.value.trim(),
    quote: state.quote,
    remembrance: els.remembrance.value.trim(),
    footer: `kept ${new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })} · made offline`,
  };
}

function updateCard() {
  renderCard(els.canvas, readFields());
}

/* ---------- quotes ---------- */

function renderChips() {
  const sentences = splitSentences(els.transcript.value);
  const ranked = quoteCandidates(sentences).slice(0, 4);
  els.quoteChips.innerHTML = '';

  if (!ranked.length) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'No sentences to choose from yet.';
    els.quoteChips.appendChild(note);
    return;
  }

  for (const candidate of ranked) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = ellipsize(candidate.text, 160);
    chip.title = candidate.reasons.join(' · ');
    chip.setAttribute('aria-pressed', String(candidate.text === state.quote));
    chip.addEventListener('click', () => {
      state.quote = candidate.text;
      renderChips();
      updateCard();
    });
    els.quoteChips.appendChild(chip);
  }
}

/* ---------- listening ---------- */

async function transcribeStory() {
  if (!asrStatus().loaded) {
    setStatus('Waking the listener — Whisper tiny.en, about 40 MB, cached after the first time…');
    setProgress(0);
    const device = await loadASR(({ pct }) => {
      if (Number.isFinite(pct)) setProgress(pct);
    });
    hideProgress();
    updateBadges();
    setStatus(`The listener is awake on ${device}.`);
  }

  setStatus(`Listening on ${asrStatus().device}… this takes about as long as the story.`);
  const raw = await transcribe(state.samples);
  const text = cleanTranscript(raw);

  if (!text) {
    setStatus('It heard silence. Try a clearer recording, or type the story yourself.', 'warn');
    return;
  }

  els.transcript.value = text;
  state.quote = pickQuote(splitSentences(text));
  renderChips();
  els.panelWords.setAttribute('aria-disabled', 'false');
  els.downloadBtn.disabled = false;
  els.keepBtn.disabled = false;
  setStatus(
    `Heard it — ${splitSentences(text).length} sentences. Check the words, then write the card.`,
    'done'
  );
}

async function handleAudio(buffer, label) {
  if (state.busy) return;
  setBusy(true);
  try {
    setStatus('Decoding the audio in this tab…');
    const { samples, seconds } = await decodeToMono16k(buffer);

    if (!withinLimit(seconds)) {
      setStatus(lengthMessage(seconds), 'warn');
      return;
    }

    state.samples = samples;
    state.seconds = seconds;
    els.audioMeta.textContent = `${label} · ${formatDuration(seconds)} · 16 kHz mono, in memory`;
    await transcribeStory();
  } catch (error) {
    setStatus(`That audio could not be read: ${error.message}`, 'warn');
  } finally {
    setBusy(false);
  }
}

/* ---------- recording ---------- */

let recorder = null;
let chunks = [];

async function startRecording() {
  if (state.recording) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size) chunks.push(event.data);
    });

    recorder.addEventListener('stop', async () => {
      stream.getTracks().forEach((track) => track.stop());
      state.recording = false;
      els.recordBtn.classList.remove('recording');
      els.recordBtn.innerHTML = '<span class="dot"></span> Start recording';
      els.stopBtn.classList.add('hidden');

      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      els.player.src = URL.createObjectURL(blob);
      els.player.classList.remove('hidden');
      await handleAudio(await blob.arrayBuffer(), 'your recording');
    });

    recorder.start();
    state.recording = true;
    els.recordBtn.classList.add('recording');
    els.recordBtn.innerHTML = '<span class="dot"></span> Recording…';
    els.stopBtn.classList.remove('hidden');
    setStatus('Recording. Tell it the way you would tell a friend.');
  } catch (error) {
    setStatus('No microphone access. Upload a file or use the sample story instead.', 'warn');
  }
}

/* ---------- writing ---------- */

async function writeCard() {
  const text = cleanTranscript(els.transcript.value);
  if (!text) {
    setStatus('There is no story yet — record one, upload one, or type it.', 'warn');
    return;
  }

  els.transcript.value = text;
  if (!state.quote) {
    state.quote = pickQuote(splitSentences(text));
    renderChips();
  }

  setBusy(true);
  try {
    if (!writerStatus().loaded) {
      if (asrStatus().loaded) {
        setStatus('Setting the listener down to make room for the writer…');
        await releaseASR();
        updateBadges();
      }
      setStatus('Waking the writer — Gemma 3 1B, about 500 MB, cached after the first time…');
      setProgress(0);
      const device = await loadWriter(({ pct }) => {
        if (Number.isFinite(pct)) setProgress(pct);
      });
      hideProgress();
      updateBadges();
      setStatus(`The writer is awake on ${device}.`);
    }

    const name = els.name.value.trim();
    const relationship = els.relationship.value.trim();
    const place = els.place.value.trim();

    setStatus('Naming the memory…');
    const title = await writeTitle({ transcript: text, name, relationship });

    setStatus('Writing the remembrance…');
    const remembrance = await writeRemembrance({
      transcript: text,
      name,
      relationship,
      place,
      quote: state.quote,
    });

    els.title.value = title.text;
    els.remembrance.value = remembrance.text;
    els.panelCard.setAttribute('aria-disabled', 'false');
    els.downloadBtn.disabled = false;
    els.keepBtn.disabled = false;
    updateCard();

    const fromModel = title.source === 'gemma' || remembrance.source === 'gemma';
    setStatus(
      fromModel
        ? 'Card ready — Gemma wrote it and the checks passed. Edit anything you like.'
        : 'Card ready — written from the facts. Edit anything you like.',
      'done'
    );
  } catch (error) {
    setStatus(`The writer stumbled: ${error.message}. Your words still make the card.`, 'warn');
  } finally {
    setBusy(false);
  }
}

/* ---------- export and shelf ---------- */

async function download() {
  updateCard();
  try {
    const blob = await cardToBlob(els.canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(els.name.value)}-ofrenda.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus('Downloaded. Print it at 4×6 in and put it where it belongs.', 'done');
  } catch (error) {
    setStatus(`The card could not be exported: ${error.message}`, 'warn');
  }
}

function keep() {
  updateCard();
  const fields = readFields();
  if (!fields.name && !fields.quote && !fields.remembrance) {
    setStatus('Write the card first — there is nothing to keep yet.', 'warn');
    return;
  }

  saveMemory({
    name: fields.name,
    years: fields.years,
    relationship: fields.relationship,
    place: fields.place,
    subtitle: fields.subtitle,
    title: fields.title,
    quote: fields.quote,
    remembrance: fields.remembrance,
  });
  renderShelf();
  setStatus('Kept on the shelf, in this browser only.', 'done');
}

function openMemory(item) {
  els.name.value = item.name || '';
  els.relationship.value = item.relationship || '';
  els.place.value = item.place || '';
  els.born.value = (String(item.years || '').match(/^(\d{4})/) || [])[1] || '';
  els.died.value = (String(item.years || '').match(/[–-]\s*(\d{4})/) || [])[1] || '';
  els.title.value = item.title || '';
  els.remembrance.value = item.remembrance || '';
  els.transcript.value = item.quote || '';
  state.quote = item.quote || '';
  els.panelCard.setAttribute('aria-disabled', 'false');
  els.downloadBtn.disabled = false;
  els.keepBtn.disabled = false;
  renderChips();
  updateCard();
  setStatus(`Opened ${item.name || 'a memory'} from the shelf.`, 'done');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderShelf() {
  const items = loadShelf();
  els.shelfCount.textContent = `${items.length} kept`;
  els.shelf.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nothing kept yet. The first card is the hardest.';
    els.shelf.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'kept';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open ${item.name || 'memory'}`);

    const title = document.createElement('h4');
    title.textContent = item.name || 'A memory';

    const quote = document.createElement('p');
    quote.textContent = item.title || ellipsize(item.quote || '', 40);

    const when = document.createElement('time');
    when.textContent = new Date(item.created).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.title = 'Remove from the shelf';
    remove.textContent = '×';

    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeMemory(item.id);
      renderShelf();
      setStatus('Removed from the shelf.', '');
    });

    card.addEventListener('click', () => openMemory(item));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMemory(item);
      }
    });

    card.append(title, quote, when, remove);
    els.shelf.appendChild(card);
  }
}

/* ---------- wiring ---------- */

els.recordBtn.addEventListener('click', startRecording);
els.stopBtn.addEventListener('click', () => {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
});

els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files && els.fileInput.files[0];
  if (!file) return;

  // Choosing the same file twice must fire again, and the previous object URL
  // should not outlive the player.
  if (playerUrl) URL.revokeObjectURL(playerUrl);
  playerUrl = URL.createObjectURL(file);
  els.player.src = playerUrl;
  els.player.classList.remove('hidden');
  els.fileInput.value = '';

  await handleAudio(await file.arrayBuffer(), file.name);
});

els.sampleBtn.addEventListener('click', async () => {
  setStatus('Fetching the sample story from this site…');
  try {
    const response = await fetch('./demo/sample.wav');
    if (!response.ok) throw new Error(`the sample is missing (${response.status})`);
    els.player.src = './demo/sample.wav';
    els.player.classList.remove('hidden');
    await handleAudio(await response.arrayBuffer(), 'sample story');
  } catch (error) {
    setStatus(`The sample could not be loaded: ${error.message}`, 'warn');
  }
});

els.writeBtn.addEventListener('click', writeCard);
els.downloadBtn.addEventListener('click', download);
els.keepBtn.addEventListener('click', keep);

els.transcript.addEventListener('change', () => {
  const text = cleanTranscript(els.transcript.value);
  if (!text) return;
  els.transcript.value = text;
  state.quote = pickQuote(splitSentences(text));
  renderChips();
  updateCard();
});

for (const input of [els.name, els.relationship, els.born, els.died, els.place, els.title, els.remembrance]) {
  input.addEventListener('input', updateCard);
}

// Ctrl/Cmd + Enter writes the card from anywhere on the page.
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!state.busy) writeCard();
  }
});

/* ---------- boot ---------- */

els.downloadBtn.disabled = true;
els.keepBtn.disabled = true;
updateBadges();
renderShelf();
renderCard(els.canvas, PLACEHOLDER);
setStatus('Ready when you are. The first run downloads the models; after that, everything is local.');
