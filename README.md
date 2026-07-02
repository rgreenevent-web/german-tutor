# German tutor for Marathi speakers

Speak (or type) in Marathi → get natural German with Devanagari pronunciation,
grammar tips, vocabulary, and **native German audio**. Voice input works in every
browser (including iPhone) because transcription runs on the server via Whisper.

## How it works

```
Marathi voice ──▶ /api/transcribe ──▶ Whisper ──▶ Marathi text
Marathi text  ──▶ /api/lesson     ──▶ Claude  ──▶ lesson JSON
German text   ──▶ /api/tts        ──▶ ElevenLabs ──▶ mp3 audio
```

Everything runs behind your server, so your API keys never reach the browser.

## Setup

1. Install Node 18 or newer.
2. In this folder:
   ```
   npm install
   cp .env.example .env
   ```
3. Open `.env` and paste your own keys:
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
   - `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` — pick a German-capable voice in your ElevenLabs library and copy its ID
   - `OPENAI_API_KEY` — for Whisper (Marathi speech-to-text)
4. Run it:
   ```
   npm start
   ```
5. Open http://localhost:3000

## Swapping providers

- **Cheaper lessons:** set `ANTHROPIC_MODEL=claude-haiku-4-5` in `.env`.
- **Google TTS instead of ElevenLabs:** replace the `/api/tts` handler in
  `server.js` with a call to Google Cloud Text-to-Speech (voice `de-DE-Neural2-*`).
  The rest of the app stays the same — it just needs an mp3 back.
- **Google Speech-to-Text instead of Whisper:** swap the `/api/transcribe` handler.

## Notes

- The teaching prompt lives in `server.js` (`lessonPrompt`). Tune it there — it is
  the actual product.
- For real users you'll want to add: a database for saved vocabulary and
  spaced-repetition review, per-user accounts, rate limiting, and audio caching so
  you don't re-synthesize the same sentence twice.
