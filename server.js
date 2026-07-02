import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = "claude-sonnet-5",
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  OPENAI_API_KEY,
  PORT = 3000,
} = process.env;

// ---------------------------------------------------------------------------
// 1) LESSON  — Marathi text  ->  Claude  ->  structured German lesson (JSON)
// ---------------------------------------------------------------------------
const lessonPrompt = (marathi) => `You are a German tutor for Marathi speakers. Teach natural, everyday German (never literal word-for-word). Silently correct any mistakes in the Marathi and teach the corrected meaning. Match tone: informal Marathi -> informal German (du); formal -> formal (Sie).

Marathi sentence: "${marathi}"

Call the give_lesson tool with the lesson. Keep vocab to the 2-5 most important words.`;

// A tool schema forces Claude to return valid structured data — no manual JSON parsing.
const lessonTool = {
  name: "give_lesson",
  description: "Return a structured German lesson for a Marathi speaker.",
  input_schema: {
    type: "object",
    properties: {
      german: { type: "string", description: "The natural German sentence." },
      phonetics: { type: "string", description: "The German sentence written in Devanagari so a Marathi speaker can read it aloud." },
      english: { type: "string", description: "English meaning." },
      grammar: { type: "string", description: "One short, simple grammar tip." },
      vocab: {
        type: "array",
        items: {
          type: "object",
          properties: {
            german: { type: "string" },
            english: { type: "string" },
            marathi: { type: "string" },
          },
          required: ["german", "english", "marathi"],
        },
      },
      example: {
        type: "object",
        properties: {
          german: { type: "string" },
          english: { type: "string" },
        },
        required: ["german", "english"],
      },
    },
    required: ["german", "phonetics", "english", "grammar", "vocab", "example"],
  },
};

app.post("/api/lesson", async (req, res) => {
  const marathi = (req.body?.marathi || "").trim();
  if (!marathi) return res.status(400).json({ error: "No Marathi text provided." });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        tools: [lessonTool],
        tool_choice: { type: "tool", name: "give_lesson" },
        messages: [{ role: "user", content: lessonPrompt(marathi) }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Claude API error" });

    // With forced tool use, the lesson arrives as a ready-made object — no JSON.parse needed.
    const toolUse = (data.content || []).find((c) => c.type === "tool_use");
    if (!toolUse) return res.status(502).json({ error: "No lesson returned." });
    res.json(toolUse.input);
  } catch (err) {
    console.error("lesson:", err);
    res.status(500).json({ error: "Could not generate the lesson." });
  }
});

// ---------------------------------------------------------------------------
// 2) TTS  — German text  ->  ElevenLabs  ->  mp3 audio
// ---------------------------------------------------------------------------
app.post("/api/tts", async (req, res) => {
  const german = (req.body?.german || "").trim();
  const speed = req.body?.speed === "slow" ? 0.75 : 1.0; // ElevenLabs speed: 0.7–1.2
  if (!german) return res.status(400).json({ error: "No German text provided." });
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "xi-api-key": ELEVENLABS_API_KEY },
        body: JSON.stringify({
          text: german,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, speed },
        }),
      }
    );
    if (!r.ok) {
      const msg = await r.text();
      return res.status(r.status).json({ error: "TTS error: " + msg.slice(0, 200) });
    }
    res.setHeader("content-type", "audio/mpeg");
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error("tts:", err);
    res.status(500).json({ error: "Could not generate audio." });
  }
});

// ---------------------------------------------------------------------------
// 3) TRANSCRIBE  — Marathi audio  ->  Whisper  ->  Marathi text
// ---------------------------------------------------------------------------
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio uploaded." });
  try {
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" }), "speech.webm");
    form.append("model", "whisper-1");
    form.append("language", "mr"); // Marathi

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Whisper error" });
    res.json({ text: data.text || "" });
  } catch (err) {
    console.error("transcribe:", err);
    res.status(500).json({ error: "Could not transcribe audio." });
  }
});

app.listen(PORT, () => console.log(`German tutor running → http://localhost:${PORT}`));
