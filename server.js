const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const TRANSLATE_MODEL = process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";

app.use(express.json({ limit: "3mb" }));
app.use(express.static(__dirname));

loadEnvFile(path.join(__dirname, ".env"));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function assertApiKey(res) {
  if (getApiKey()) return true;
  res.status(500).json({
    error: "OPENAI_API_KEY is not set. Set it in env or english-study-app/.env.",
  });
  return false;
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content?.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }
  return "";
}

app.post("/api/translate", async (req, res) => {
  if (!assertApiKey(res)) return;
  const apiKey = getApiKey();

  const japanese = String(req.body?.japanese || "").trim();
  if (!japanese) {
    return res.status(400).json({ error: "japanese is required." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are an expert English tutor. Translate Japanese into natural spoken English for learners. Return only the English sentence.",
          },
          {
            role: "user",
            content: japanese,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `translate failed: ${errorText}` });
    }

    const data = await response.json();
    const english = extractResponseText(data);
    if (!english) {
      return res.status(500).json({
        error: "Translate succeeded but no text was returned. Check model response format.",
      });
    }
    return res.json({ english });
  } catch (error) {
    return res.status(500).json({ error: `translate error: ${error.message}` });
  }
});

app.post("/api/tts", async (req, res) => {
  if (!assertApiKey(res)) return;
  const apiKey = getApiKey();

  const english = String(req.body?.english || "").trim();
  if (!english) {
    return res.status(400).json({ error: "english is required." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: english,
        format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `tts failed: ${errorText}` });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(audioBuffer);
  } catch (error) {
    return res.status(500).json({ error: `tts error: ${error.message}` });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, HOST, () => {
  console.log(`Server running: http://${HOST}:${PORT}`);
});
