# Build notes

These are the notes from the session that built Ofrenda. They are kept in the repo
because the interesting part of a small-model project is not the prompt that worked; it
is the list of things that did not.

## Shape of the work

The project was built outside-in: first the pure rules that can be tested without a
browser, then the two model wrappers, then the painter, then the controller that puts
them in order. The order matters. Every decision that a family might disagree with — which
sentence goes on the wall, how many words a remembrance may have, whether the model is
allowed to quote someone — was made in code, with a test, before any model was loaded.

The agent wrote the code and ran the tests; the human set the constraints (no paid APIs,
no uploads, a real keepsake rather than a demo page) and made the design calls that could
not be automated: the theme, the voice of the card, and the rule that the model may not
invent dialogue.

## What was measured, not assumed

| Thing | Measurement |
| --- | --- |
| Whisper tiny.en q8, first load (download included) | 102 s |
| Whisper tiny.en q8, warm load | ~8 s |
| 33.2 s of audio → transcript on WebGPU | 42 s |
| Gemma 3 1B q4, first load (download included) | 89 s |
| Gemma 3 1B q4, one title + one remembrance | ~37 s |
| Card layout + paint at 1200 × 1600 | under 10 ms |
| Tests | 44 assertions, 4 files, no dependencies |

Transcription accuracy on the synthetic sample was near-perfect: one word in 82
("her recipe" for "a recipe"). That single error is the reason the transcript is editable
and the reason the demo shows the correction.

## Bugs found by running it, not by reading it

1. **English-only Whisper rejects the language flag.**
   `pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en')` throws
   `Cannot specify task or language for an English-only model`. The fix was to stop
   passing `language` and `task`; the model already knows.

2. **The 1B echoed the prompt.**
   With a raw string prompt, Gemma 3 1B continued the instruction text and fell into
   markdown fences ("Do not write the word \"..." followed by ``` blocks). Switching to
   the chat template — system and user messages — fixed it completely. The same prompt
   as plain text produced garbage; as a conversation it produced three sentences.

3. **The 1B invented dialogue.**
   One generation included `She'd simply say, "Listen closely"` — a line that appears
   nowhere in the story. That is exactly the failure a memory keeper cannot ship. The
   validator now rejects any remembrance containing quotation marks, and the prompt asks
   the model not to quote anyone. The card falls back to facts rather than fiction.

4. **The 1B wrote about its own circuits.**
   A later generation began "The scent of warm bread fills my circuits with memories."
   The machine voice leaked into a family card. "circuits", "algorithm", "neural network"
   and "artificial intelligence" are now rejected by the same bouncer.

5. **q4f16 reloaded the tab on first load.**
   With `dtype: 'q4f16'` on WebGPU, the renderer was reloaded by Chrome during the first
   Gemma load — twice. The same model at `dtype: 'q4'` loaded in 89 s and generated
   normally. The app now uses q4 on both WebGPU and WASM.

6. **Two models, one GPU.**
   Holding Whisper and Gemma at the same time is more memory than a tab is always given.
   `releaseASR()` disposes the Whisper pipeline before the writer wakes; the weights stay
   in the HTTP cache, so the listener wakes again in seconds. The badge in the header
   shows the handover.

7. **The empty card.**
   The first card layout left the bottom third of the paper blank. The quote and the
   remembrance are now one composition, centred between the divider and a drawn marigold,
   so a short memory does not leave the card hollow.

## What the model does not decide

- Which sentence is the quote. Scoring is code: first person, distinct sensory details,
  a comfortable length, and a penalty for funeral language.
- Whether the prose is acceptable. Guards are code.
- What the card says when the model fails. The fallback is code, built from the facts.
- Where anything sits. Geometry is code, and it is tested without a canvas.

The model is given exactly one kind of authority: how the sentence sounds.

## Deliberate omissions

- No framework, no bundler, no build step. The whole app is ES modules and one canvas.
- No backend, no account, no sync. The shelf is localStorage, and the PNG is the export.
- No cloud fallback. If the models cannot load, the card still works from the typed
  transcript and the deterministic fallback; the app never silently sends anything.
- No model selector. Gemma 3 270M was tested and rejected: it hallucinated an entirely
  different person. The 1B is the smallest model that wrote something worth keeping.

## Honest notes about the demo

- `demo/sample.wav` is synthetic speech generated offline with Windows SAPI (Zira), from a
  story written for this project. No real family recording is in the repo.
- "Amma" and "Kochi" are illustrative, not a real person.
- The screenshots are from a real run: the sample was transcribed by Whisper, the title
  and remembrance were written by Gemma, and the card was exported from the canvas.
- The transcript in the screenshot has one human correction ("a recipe"), shown on purpose.
