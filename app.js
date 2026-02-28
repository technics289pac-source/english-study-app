const STORAGE_KEY = "english_practice_notes_v4";

const addForm = document.getElementById("add-form");
const englishInput = document.getElementById("english");
const japaneseInput = document.getElementById("japanese");
const toggleJapanese = document.getElementById("toggle-japanese");
const translateBtn = document.getElementById("translate-btn");
const ttsBtn = document.getElementById("tts-btn");
const statusEl = document.getElementById("status");
const list = document.getElementById("list");
const template = document.getElementById("card-template");

const defaultItems = [
  {
    id: crypto.randomUUID(),
    english: "Nice to meet you. I study English every day.",
    japanese: "\u306f\u3058\u3081\u307e\u3057\u3066\u3002\u6bce\u65e5\u82f1\u8a9e\u3092\u52c9\u5f37\u3057\u3066\u3044\u307e\u3059\u3002",
    audioUrl: "",
  },
];

let items = loadItems();
let generatedAudioUrl = "";

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
    let message = "\u7ffb\u8a33\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002";
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
    let message = "\u97f3\u58f0\u751f\u6210\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002";
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
      new Audio(item.audioUrl).play().catch(() =>
        alert("\u97f3\u58f0\u3092\u518d\u751f\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002")
      );
    });

    speakButton.addEventListener("click", () => {
      if (!("speechSynthesis" in window)) {
        alert("\u3053\u306e\u30d6\u30e9\u30a6\u30b6\u306f\u97f3\u58f0\u8aad\u307f\u4e0a\u3052\u306b\u5bfe\u5fdc\u3057\u3066\u3044\u307e\u305b\u3093\u3002");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(item.english);
      utterance.lang = "en-US";
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });

    deleteButton.addEventListener("click", () => {
      items = items.filter((x) => x.id !== item.id);
      saveItems();
      render();
    });

    list.appendChild(node);
  }
}

translateBtn.addEventListener("click", async () => {
  const japanese = japaneseInput.value.trim();
  if (!japanese) {
    return setStatus(
      "\u5148\u306b\u65e5\u672c\u8a9e\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      true
    );
  }
  translateBtn.disabled = true;
  setStatus("\u7ffb\u8a33\u4e2d...");
  try {
    englishInput.value = await requestNaturalEnglish(japanese);
    setStatus("\u7ffb\u8a33\u3057\u307e\u3057\u305f\u3002");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    translateBtn.disabled = false;
  }
});

ttsBtn.addEventListener("click", async () => {
  const english = englishInput.value.trim();
  if (!english) {
    return setStatus(
      "\u5148\u306b\u82f1\u8a9e\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      true
    );
  }
  ttsBtn.disabled = true;
  setStatus("\u97f3\u58f0\u3092\u751f\u6210\u4e2d...");
  try {
    generatedAudioUrl = await requestTtsAudio(english);
    try {
      await new Audio(generatedAudioUrl).play();
      setStatus("\u97f3\u58f0\u3092\u751f\u6210\u3057\u3066\u518d\u751f\u3057\u307e\u3057\u305f\u3002");
    } catch {
      setStatus(
        "\u97f3\u58f0\u3092\u751f\u6210\u3057\u307e\u3057\u305f\u3002\u518d\u751f\u306f Play \u30dc\u30bf\u30f3\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
        true
      );
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    ttsBtn.disabled = false;
  }
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const english = englishInput.value.trim();
  const japanese = japaneseInput.value.trim();

  if (!japanese) return setStatus("\u65e5\u672c\u8a9e\u306f\u5fc5\u9808\u3067\u3059\u3002", true);
  if (!english) return setStatus("\u82f1\u8a9e\u306f\u5fc5\u9808\u3067\u3059\u3002", true);

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
  setStatus("\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002");
});

toggleJapanese.addEventListener("change", render);
