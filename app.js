const STORAGE_KEY = "english_practice_notes_v3";
const CLOUD_CONFIG_KEY = "english_practice_cloud_config_v1";

const addForm = document.getElementById("add-form");
const englishInput = document.getElementById("english");
const japaneseInput = document.getElementById("japanese");
const toggleJapanese = document.getElementById("toggle-japanese");
const translateBtn = document.getElementById("translate-btn");
const ttsBtn = document.getElementById("tts-btn");
const saveCloudConfigBtn = document.getElementById("save-cloud-config-btn");
const loadCloudBtn = document.getElementById("load-cloud-btn");
const statusEl = document.getElementById("status");
const list = document.getElementById("list");
const template = document.getElementById("card-template");

const supabaseUrlInput = document.getElementById("supabase-url");
const supabaseAnonKeyInput = document.getElementById("supabase-anon-key");
const cloudUserIdInput = document.getElementById("cloud-user-id");

const defaultItems = [
  {
    id: crypto.randomUUID(),
    english: "Nice to meet you. I study English every day.",
    japanese: "はじめまして。毎日英語を勉強しています。",
    audioUrl: "",
  },
];

let items = loadItems();
let supabaseClient = null;
let generatedAudioUrl = "";

initCloudConfig();
render();
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is optional.
    });
  });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultItems;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultItems;
  } catch {
    return defaultItems;
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadCloudConfig() {
  const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (!raw) return { url: "", anonKey: "", userId: "" };
  try {
    const parsed = JSON.parse(raw);
    return {
      url: String(parsed.url || ""),
      anonKey: String(parsed.anonKey || ""),
      userId: String(parsed.userId || ""),
    };
  } catch {
    return { url: "", anonKey: "", userId: "" };
  }
}

function saveCloudConfig(config) {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
}

function initCloudConfig() {
  const config = loadCloudConfig();
  supabaseUrlInput.value = config.url;
  supabaseAnonKeyInput.value = config.anonKey;
  cloudUserIdInput.value = config.userId;

  if (config.url && config.anonKey && window.supabase?.createClient) {
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  }
}

function getCloudConfigFromInput() {
  return {
    url: supabaseUrlInput.value.trim(),
    anonKey: supabaseAnonKeyInput.value.trim(),
    userId: cloudUserIdInput.value.trim() || "default-user",
  };
}

function ensureSupabaseClient() {
  const config = getCloudConfigFromInput();
  if (!config.url || !config.anonKey) {
    throw new Error("Set Supabase URL and anon key first.");
  }
  if (!window.supabase?.createClient) {
    throw new Error("Supabase library is not loaded.");
  }
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  }
  return { client: supabaseClient, config };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function requestNaturalEnglish(japaneseText) {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ japanese: japaneseText }),
  });
  if (!res.ok) {
    let message = "Translation failed.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  const data = await res.json();
  return data.english || "";
}

async function requestTtsAudio(englishText) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ english: englishText }),
  });
  if (!res.ok) {
    let message = "Voice generation failed.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

async function upsertCloudItem(item) {
  const { client, config } = ensureSupabaseClient();
  const payload = {
    id: item.id,
    user_id: config.userId,
    english: item.english,
    japanese: item.japanese,
    audio_url: item.audioUrl || "",
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from("study_sentences").upsert(payload);
  if (error) throw new Error(`Cloud save failed: ${error.message}`);
}

async function deleteCloudItem(id) {
  const { client, config } = ensureSupabaseClient();
  const { error } = await client
    .from("study_sentences")
    .delete()
    .eq("id", id)
    .eq("user_id", config.userId);
  if (error) throw new Error(`Cloud delete failed: ${error.message}`);
}

async function loadFromCloud() {
  const { client, config } = ensureSupabaseClient();
  const { data, error } = await client
    .from("study_sentences")
    .select("id, english, japanese, audio_url")
    .eq("user_id", config.userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Cloud load failed: ${error.message}`);

  items = (data || []).map((row) => ({
    id: row.id,
    english: row.english,
    japanese: row.japanese,
    audioUrl: row.audio_url || "",
  }));
  saveItems();
  render();
}

function render() {
  list.innerHTML = "";
  const showJapanese = toggleJapanese.checked;

  for (const item of items) {
    const node = template.content.firstElementChild.cloneNode(true);
    const english = node.querySelector(".english");
    const japanese = node.querySelector(".japanese");
    const playButton = node.querySelector(".play");
    const speakButton = node.querySelector(".speak");
    const deleteButton = node.querySelector(".delete");

    english.textContent = item.english;
    japanese.textContent = item.japanese;
    if (!showJapanese) japanese.classList.add("hidden");

    playButton.disabled = !item.audioUrl;
    playButton.addEventListener("click", () => {
      if (!item.audioUrl) return;
      new Audio(item.audioUrl).play().catch(() => alert("Cannot play audio."));
    });

    speakButton.addEventListener("click", () => {
      if (!("speechSynthesis" in window)) {
        alert("Speech synthesis is not supported in this browser.");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(item.english);
      utterance.lang = "en-US";
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });

    deleteButton.addEventListener("click", async () => {
      const deleted = item;
      items = items.filter((x) => x.id !== item.id);
      saveItems();
      render();
      try {
        await deleteCloudItem(deleted.id);
      } catch {
        // optional cloud sync
      }
    });

    list.appendChild(node);
  }
}

saveCloudConfigBtn.addEventListener("click", () => {
  const config = getCloudConfigFromInput();
  saveCloudConfig(config);
  supabaseClient = null;
  try {
    ensureSupabaseClient();
    setStatus("Cloud settings saved.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadCloudBtn.addEventListener("click", async () => {
  loadCloudBtn.disabled = true;
  setStatus("Loading from cloud...");
  try {
    await loadFromCloud();
    setStatus("Loaded from cloud.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    loadCloudBtn.disabled = false;
  }
});

translateBtn.addEventListener("click", async () => {
  const japanese = japaneseInput.value.trim();
  if (!japanese) return setStatus("Enter Japanese text first.", true);
  translateBtn.disabled = true;
  setStatus("Translating...");
  try {
    englishInput.value = await requestNaturalEnglish(japanese);
    setStatus("Translated.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    translateBtn.disabled = false;
  }
});

ttsBtn.addEventListener("click", async () => {
  const english = englishInput.value.trim();
  if (!english) return setStatus("Enter English text first.", true);
  ttsBtn.disabled = true;
  setStatus("Generating voice...");
  try {
    generatedAudioUrl = await requestTtsAudio(english);
    try {
      await new Audio(generatedAudioUrl).play();
      setStatus("Voice generated and playing.");
    } catch {
      setStatus("Voice generated. Tap Play if autoplay was blocked.", true);
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    ttsBtn.disabled = false;
  }
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const english = englishInput.value.trim();
  const japanese = japaneseInput.value.trim();

  if (!japanese) return setStatus("Japanese is required.", true);
  if (!english) return setStatus("English is required.", true);

  const newItem = {
    id: crypto.randomUUID(),
    english,
    japanese,
    audioUrl: generatedAudioUrl,
  };

  items.unshift(newItem);
  saveItems();
  addForm.reset();
  generatedAudioUrl = "";
  render();
  setStatus("Added.");

  try {
    await upsertCloudItem(newItem);
    setStatus("Added and synced to cloud.");
  } catch {
    // optional cloud sync
  }
});

toggleJapanese.addEventListener("change", render);
