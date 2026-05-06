const SCHOOLS = [
  { id: "CMU", label: "中國醫" },
  { id: "TCU", label: "慈濟" },
  { id: "ISU", label: "義守" },
];
const YEARS = ["115", "114", "113", "112", "111", "110", "109", "108", "107", "106"];
const CHOICES = ["A", "B", "C", "D", "E"];
const WRONG_KEY = "chemistryPracticeWrongIds";
const HISTORY_KEY = "chemistryPracticeHistory";
const SYNC_SETTINGS_KEY = "chemistryPracticeSyncSettings";
const LAST_PULL_KEY = "chemistryPracticeLastAutoPull";
const QUESTION_BASE =
  (window.CHEM_SYNC_CONFIG && window.CHEM_SYNC_CONFIG.questionBase) ||
  window.CHEM_QUESTION_BASE ||
  "/questions";

const state = {
  allQuestions: [],
  session: [],
  selectedIndex: 0,
  selectedSchools: new Set(SCHOOLS.map((school) => school.id)),
  selectedYears: new Set(YEARS),
  answers: new Map(),
  history: new Map(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")),
  answerVisible: false,
  wrongIds: new Set(JSON.parse(localStorage.getItem(WRONG_KEY) || "[]")),
  syncSettings: loadSyncSettings(),
  syncTimer: null,
  isPullingCloud: false,
};

const els = {
  loadState: document.querySelector("#loadState"),
  schoolFilters: document.querySelector("#schoolFilters"),
  yearFilters: document.querySelector("#yearFilters"),
  sessionSize: document.querySelector("#sessionSize"),
  modeFilter: document.querySelector("#modeFilter"),
  searchInput: document.querySelector("#searchInput"),
  startBtn: document.querySelector("#startBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  scriptUrlInput: document.querySelector("#scriptUrlInput"),
  syncUserInput: document.querySelector("#syncUserInput"),
  deviceLabelInput: document.querySelector("#deviceLabelInput"),
  saveSyncSettingsBtn: document.querySelector("#saveSyncSettingsBtn"),
  pushCloudBtn: document.querySelector("#pushCloudBtn"),
  pullCloudBtn: document.querySelector("#pullCloudBtn"),
  exportStateBtn: document.querySelector("#exportStateBtn"),
  importStateInput: document.querySelector("#importStateInput"),
  syncStatus: document.querySelector("#syncStatus"),
  metaLine: document.querySelector("#metaLine"),
  questionTitle: document.querySelector("#questionTitle"),
  wrongBtn: document.querySelector("#wrongBtn"),
  questionImage: document.querySelector("#questionImage"),
  imageFallback: document.querySelector("#imageFallback"),
  choiceButtons: document.querySelector("#choiceButtons"),
  showAnswerBtn: document.querySelector("#showAnswerBtn"),
  answerResult: document.querySelector("#answerResult"),
  answerValue: document.querySelector("#answerValue"),
  answerSource: document.querySelector("#answerSource"),
  clarification: document.querySelector("#clarification"),
  amoStatus: document.querySelector("#amoStatus"),
  reviewStatus: document.querySelector("#reviewStatus"),
  progressText: document.querySelector("#progressText"),
  correctText: document.querySelector("#correctText"),
  wrongText: document.querySelector("#wrongText"),
  questionList: document.querySelector("#questionList"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
};

function loadSyncSettings() {
  const embedded = window.CHEM_SYNC_CONFIG || {};
  const saved = JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || "{}");
  return {
    scriptUrl: saved.scriptUrl || embedded.scriptUrl || "",
    userId: saved.userId || embedded.userId || "",
    deviceLabel: saved.deviceLabel || embedded.deviceLabel || navigator.userAgent.split(" ")[0],
  };
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((item) => item.length > 1)
    .map((item) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), item[index] || ""])),
    );
}

function imageUrl(value) {
  const normalized = String(value || "").replaceAll("\\", "/");
  const marker = "/questions/";
  const index = normalized.indexOf(marker);
  if (index >= 0) return `${QUESTION_BASE}/${normalized.slice(index + marker.length)}`;
  if (normalized.startsWith("questions/")) return `${QUESTION_BASE}/${normalized.slice("questions/".length)}`;
  return normalized;
}

function normalizeAnswer(answer) {
  return String(answer || "")
    .toUpperCase()
    .replaceAll("Ａ", "A")
    .replaceAll("Ｂ", "B")
    .replaceAll("Ｃ", "C")
    .replaceAll("Ｄ", "D")
    .replaceAll("Ｅ", "E");
}

function acceptedChoices(answer) {
  const normalized = normalizeAnswer(answer);
  if (normalized.includes("送分")) return CHOICES;
  return CHOICES.filter((choice) => normalized.includes(choice));
}

function questionId(q) {
  return `${q.schoolId}-${q.year}-${String(q.number).padStart(3, "0")}`;
}

function saveWrongIds() {
  localStorage.setItem(WRONG_KEY, JSON.stringify([...state.wrongIds]));
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([...state.history.entries()]));
}

function canCloudSync() {
  return Boolean(state.syncSettings.scriptUrl && state.syncSettings.userId);
}

function statePayload() {
  return {
    app: "post-bacc-cm-chemistry-practice",
    version: 1,
    exportedAt: new Date().toISOString(),
    wrongIds: [...state.wrongIds],
    history: [...state.history.entries()],
  };
}

async function loadQuestions() {
  if (Array.isArray(window.CHEM_EMBEDDED_QUESTIONS)) {
    state.allQuestions = window.CHEM_EMBEDDED_QUESTIONS.sort(
      (a, b) =>
        a.schoolId.localeCompare(b.schoolId) ||
        Number(b.year) - Number(a.year) ||
        a.number - b.number,
    );
    return;
  }

  const loaded = [];
  for (const school of SCHOOLS) {
    for (const year of YEARS) {
      const file = `${QUESTION_BASE}/${school.id}_${year}_chemistry_questions.csv`;
      const response = await fetch(file);
      if (!response.ok) continue;
      const rows = parseCsv(await response.text());
      for (const row of rows) {
        loaded.push({
          id: `${school.id}-${row["年度"]}-${String(row["題號"]).padStart(3, "0")}`,
          schoolId: school.id,
          school: row["學校"] || school.label,
          year: row["年度"],
          subject: row["科目"] || "化學",
          number: Number(row["題號"]),
          unit: row["單元"] || "",
          type: row["題型"] || "",
          answer: row["答案"] || "",
          answerSource: row["答案來源"] || "",
          clarification: row["釋疑校對"] || "",
          amoStatus: row["阿摩校對"] || "",
          explanation: row["詳解"] || "",
          image: imageUrl(row["題目圖"]),
          reviewStatus: row["狀態"] || "",
          note: row["備註"] || "",
        });
      }
    }
  }

  state.allQuestions = loaded.sort(
    (a, b) =>
      a.schoolId.localeCompare(b.schoolId) ||
      Number(b.year) - Number(a.year) ||
      a.number - b.number,
  );
}

function makeChip(label, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = active ? "chip active" : "chip";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderFilters() {
  els.schoolFilters.innerHTML = "";
  SCHOOLS.forEach((school) => {
    els.schoolFilters.append(
      makeChip(school.label, state.selectedSchools.has(school.id), () => {
        toggleSetValue(state.selectedSchools, school.id, SCHOOLS.map((item) => item.id));
        renderFilters();
      }),
    );
  });

  els.yearFilters.innerHTML = "";
  YEARS.forEach((year) => {
    els.yearFilters.append(
      makeChip(year, state.selectedYears.has(year), () => {
        toggleSetValue(state.selectedYears, year, YEARS);
        renderFilters();
      }),
    );
  });
}

function toggleSetValue(set, value, fallbackValues) {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
  if (!set.size) {
    fallbackValues.forEach((item) => set.add(item));
  }
}

function filteredPool() {
  const query = els.searchInput.value.trim().toLowerCase();
  return state.allQuestions.filter((q) => {
    if (!state.selectedSchools.has(q.schoolId) || !state.selectedYears.has(q.year)) return false;
    if (els.modeFilter.value === "wrong" && !state.wrongIds.has(q.id)) return false;
    if (!query) return true;
    const haystack = `${q.school} ${q.schoolId} ${q.year} ${q.number} ${q.answer} ${q.answerSource} ${q.clarification} ${q.amoStatus} ${q.reviewStatus}`.toLowerCase();
    return haystack.includes(query);
  });
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function startSession() {
  const pool = shuffled(filteredPool());
  const size = els.sessionSize.value === "all" ? pool.length : Number(els.sessionSize.value);
  state.session = pool.slice(0, size);
  state.selectedIndex = 0;
  state.answers = new Map();
  state.answerVisible = false;
  render();
}

function currentQuestion() {
  return state.session[state.selectedIndex];
}

function render() {
  renderQuestion();
  renderList();
  renderStats();
}

function renderQuestion() {
  const q = currentQuestion();
  const hasQuestion = Boolean(q);
  els.prevBtn.disabled = !hasQuestion;
  els.nextBtn.disabled = !hasQuestion;
  els.wrongBtn.disabled = !hasQuestion;
  els.showAnswerBtn.disabled = !hasQuestion;

  if (!q) {
    els.metaLine.textContent = "目前沒有題目";
    els.questionTitle.textContent = "請調整範圍後開始出題";
    els.questionImage.classList.remove("loaded");
    els.questionImage.removeAttribute("src");
    els.imageFallback.textContent = state.allQuestions.length ? "找不到符合條件的題目。" : "題庫載入中。";
    els.choiceButtons.innerHTML = "";
    els.answerResult.textContent = "尚未作答";
    els.answerResult.className = "answer-result";
    setDetailText(null);
    updateWrongButton(null);
    return;
  }

  const selected = state.answers.get(q.id);
  const accepted = acceptedChoices(q.answer);
  els.metaLine.textContent = `${q.school} / ${q.year} / ${q.subject}`;
  els.questionTitle.textContent = `第 ${q.number} 題`;
  els.questionImage.classList.remove("loaded");
  els.questionImage.src = q.image;
  els.questionImage.onload = () => {
    els.questionImage.classList.add("loaded");
    els.imageFallback.textContent = "";
  };
  els.questionImage.onerror = () => {
    els.questionImage.classList.remove("loaded");
    els.imageFallback.textContent = "題圖載入失敗，請確認本機伺服器從專案根目錄啟動。";
  };

  els.choiceButtons.innerHTML = "";
  CHOICES.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice;
    if (selected === choice) button.classList.add("selected");
    if (state.answerVisible && accepted.includes(choice)) button.classList.add("correct");
    if (state.answerVisible && selected === choice && !accepted.includes(choice)) {
      button.classList.add("incorrect");
    }
    button.addEventListener("click", () => chooseAnswer(choice));
    els.choiceButtons.append(button);
  });

  renderAnswerResult(q, selected);
  setDetailText(q);
  updateWrongButton(q);
}

function chooseAnswer(choice) {
  const q = currentQuestion();
  if (!q) return;
  state.answers.set(q.id, choice);
  state.history.set(q.id, {
    selected: choice,
    correct: acceptedChoices(q.answer).includes(choice),
    updatedAt: new Date().toISOString(),
  });
  saveHistory();
  state.answerVisible = true;
  if (!acceptedChoices(q.answer).includes(choice)) {
    state.wrongIds.add(q.id);
    saveWrongIds();
  }
  scheduleCloudPush();
  render();
}

function exportState() {
  const payload = statePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `後中醫化學題庫狀態_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  els.syncStatus.textContent = "已匯出狀態檔";
}

async function importState(file) {
  if (!file) return;
  const payload = JSON.parse(await file.text());
  if (payload.app !== "post-bacc-cm-chemistry-practice" || !Array.isArray(payload.wrongIds)) {
    throw new Error("這不是此題庫 App 的狀態檔");
  }
  state.wrongIds = new Set(payload.wrongIds);
  state.history = new Map(Array.isArray(payload.history) ? payload.history : []);
  saveWrongIds();
  saveHistory();
  els.syncStatus.textContent = `已匯入 ${state.wrongIds.size} 筆錯題狀態`;
  scheduleCloudPush();
  render();
}

function initSyncSettings() {
  els.scriptUrlInput.value = state.syncSettings.scriptUrl;
  els.syncUserInput.value = state.syncSettings.userId;
  els.deviceLabelInput.value = state.syncSettings.deviceLabel;
  updateCloudButtons();
}

function saveSyncSettings() {
  state.syncSettings = {
    scriptUrl: els.scriptUrlInput.value.trim(),
    userId: els.syncUserInput.value.trim(),
    deviceLabel: els.deviceLabelInput.value.trim() || "browser",
  };
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(state.syncSettings));
  els.syncStatus.textContent = state.syncSettings.scriptUrl && state.syncSettings.userId
    ? "同步設定已儲存"
    : "請填 Apps Script URL 和同步代號";
  updateCloudButtons();
}

function updateCloudButtons() {
  const ready = canCloudSync();
  els.pushCloudBtn.disabled = !ready;
  els.pullCloudBtn.disabled = !ready;
}

async function pushCloudState(options = {}) {
  if (!options.skipSaveSettings) saveSyncSettings();
  if (!canCloudSync()) return;
  const payload = {
    ...statePayload(),
    userId: state.syncSettings.userId,
    deviceLabel: state.syncSettings.deviceLabel,
  };
  await fetch(state.syncSettings.scriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  els.syncStatus.textContent = `已自動同步到雲端 ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
}

function scheduleCloudPush() {
  if (!canCloudSync() || state.isPullingCloud) return;
  clearTimeout(state.syncTimer);
  els.syncStatus.textContent = "已排程自動同步";
  state.syncTimer = setTimeout(() => {
    pushCloudState({ skipSaveSettings: true }).catch((error) => {
      els.syncStatus.textContent = `自動同步失敗：${error.message}`;
    });
  }, 2500);
}

function pullCloudState(options = {}) {
  if (!options.skipSaveSettings) saveSyncSettings();
  if (!canCloudSync()) return;
  const callbackName = `chemSyncCallback_${Date.now()}`;
  const url = new URL(state.syncSettings.scriptUrl);
  url.searchParams.set("action", "get");
  url.searchParams.set("userId", state.syncSettings.userId);
  url.searchParams.set("deviceLabel", state.syncSettings.deviceLabel);
  url.searchParams.set("callback", callbackName);

  state.isPullingCloud = true;
  els.syncStatus.textContent = options.auto ? "正在自動讀取雲端狀態" : "正在讀取雲端狀態";
  window[callbackName] = (result) => {
    try {
      if (!result.ok) throw new Error(result.error || "雲端讀取失敗");
      const cloudState = result.state || {};
      state.wrongIds = new Set(cloudState.wrongIds || []);
      state.history = new Map(cloudState.history || []);
      saveWrongIds();
      saveHistory();
      localStorage.setItem(LAST_PULL_KEY, new Date().toISOString());
      els.syncStatus.textContent = `已取回雲端狀態：${state.wrongIds.size} 筆錯題`;
      render();
    } catch (error) {
      els.syncStatus.textContent = error.message;
    } finally {
      state.isPullingCloud = false;
      delete window[callbackName];
      script.remove();
    }
  };

  const script = document.createElement("script");
  script.src = url.toString();
  script.onerror = () => {
    els.syncStatus.textContent = "雲端讀取失敗，請檢查 Apps Script URL";
    state.isPullingCloud = false;
    delete window[callbackName];
    script.remove();
  };
  document.body.append(script);
}

function autoPullCloudState() {
  if (!canCloudSync()) return;
  const lastPull = Date.parse(localStorage.getItem(LAST_PULL_KEY) || "");
  if (Number.isFinite(lastPull) && Date.now() - lastPull < 60_000) return;
  setTimeout(() => pullCloudState({ skipSaveSettings: true, auto: true }), 800);
}

function renderAnswerResult(q, selected) {
  const accepted = acceptedChoices(q.answer);
  if (!state.answerVisible && !selected) {
    els.answerResult.textContent = "尚未作答";
    els.answerResult.className = "answer-result";
    return;
  }
  if (!accepted.length) {
    els.answerResult.textContent = `答案：${q.answer || "-"}`;
    els.answerResult.className = "answer-result";
    return;
  }
  if (!selected) {
    els.answerResult.textContent = `答案：${q.answer}`;
    els.answerResult.className = "answer-result";
    return;
  }
  const correct = accepted.includes(selected);
  els.answerResult.textContent = correct ? `答對，答案：${q.answer}` : `答錯，答案：${q.answer}`;
  els.answerResult.className = correct ? "answer-result correct" : "answer-result incorrect";
}

function setDetailText(q) {
  els.answerValue.textContent = q ? q.answer || "-" : "-";
  els.answerSource.textContent = q ? q.answerSource || "-" : "-";
  els.clarification.textContent = q ? q.clarification || "-" : "-";
  els.amoStatus.textContent = q ? q.amoStatus || "-" : "-";
  els.reviewStatus.textContent = q ? q.reviewStatus || "-" : "-";
}

function updateWrongButton(q) {
  if (!q) {
    els.wrongBtn.className = "mark-btn";
    els.wrongBtn.textContent = "加入錯題";
    els.wrongBtn.setAttribute("aria-pressed", "false");
    return;
  }
  const saved = state.wrongIds.has(q.id);
  els.wrongBtn.className = saved ? "mark-btn saved" : "mark-btn";
  els.wrongBtn.textContent = saved ? "移出錯題" : "加入錯題";
  els.wrongBtn.setAttribute("aria-pressed", String(saved));
}

function renderList() {
  els.questionList.innerHTML = "";
  state.session.forEach((q, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(index + 1);
    if (index === state.selectedIndex) button.classList.add("active");
    if (state.answers.has(q.id)) button.classList.add("answered");
    if (state.wrongIds.has(q.id)) button.classList.add("flagged");
    button.title = `${q.school} ${q.year} 第 ${q.number} 題`;
    button.addEventListener("click", () => {
      state.selectedIndex = index;
      state.answerVisible = false;
      render();
    });
    els.questionList.append(button);
  });
}

function renderStats() {
  const answered = [...state.answers.entries()];
  const correct = answered.filter(([id, selected]) => {
    const q = state.session.find((item) => item.id === id);
    return q && acceptedChoices(q.answer).includes(selected);
  }).length;
  els.progressText.textContent = `${state.session.length ? state.selectedIndex + 1 : 0} / ${state.session.length}`;
  els.correctText.textContent = String(correct);
  els.wrongText.textContent = String(state.wrongIds.size);
}

function move(delta) {
  if (!state.session.length) return;
  state.selectedIndex = (state.selectedIndex + delta + state.session.length) % state.session.length;
  state.answerVisible = false;
  render();
}

function resetFilters() {
  state.selectedSchools = new Set(SCHOOLS.map((school) => school.id));
  state.selectedYears = new Set(YEARS);
  els.sessionSize.value = "25";
  els.modeFilter.value = "all";
  els.searchInput.value = "";
  renderFilters();
  startSession();
}

els.startBtn.addEventListener("click", startSession);
els.shuffleBtn.addEventListener("click", startSession);
els.resetBtn.addEventListener("click", resetFilters);
els.saveSyncSettingsBtn.addEventListener("click", saveSyncSettings);
els.pushCloudBtn.addEventListener("click", () => {
  pushCloudState().catch((error) => {
    els.syncStatus.textContent = error.message;
  });
});
els.pullCloudBtn.addEventListener("click", pullCloudState);
els.exportStateBtn.addEventListener("click", exportState);
els.importStateInput.addEventListener("change", async (event) => {
  try {
    await importState(event.target.files[0]);
  } catch (error) {
    els.syncStatus.textContent = error.message;
  } finally {
    event.target.value = "";
  }
});
els.searchInput.addEventListener("input", () => {
  if (!state.session.length) return;
  startSession();
});
els.modeFilter.addEventListener("change", startSession);
els.sessionSize.addEventListener("change", startSession);
els.prevBtn.addEventListener("click", () => move(-1));
els.nextBtn.addEventListener("click", () => move(1));
els.showAnswerBtn.addEventListener("click", () => {
  state.answerVisible = true;
  renderQuestion();
});
els.wrongBtn.addEventListener("click", () => {
  const q = currentQuestion();
  if (!q) return;
  if (state.wrongIds.has(q.id)) {
    state.wrongIds.delete(q.id);
  } else {
    state.wrongIds.add(q.id);
  }
  saveWrongIds();
  scheduleCloudPush();
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
  if (CHOICES.includes(event.key.toUpperCase())) chooseAnswer(event.key.toUpperCase());
  if (event.key === " ") {
    event.preventDefault();
    state.answerVisible = true;
    renderQuestion();
  }
});

renderFilters();
initSyncSettings();
loadQuestions()
  .then(() => {
    els.loadState.textContent = `${state.allQuestions.length} 題`;
    startSession();
    autoPullCloudState();
  })
  .catch((error) => {
    els.loadState.textContent = "載入失敗";
    els.metaLine.textContent = "題庫載入失敗";
    els.questionTitle.textContent = error.message;
  });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      els.syncStatus.textContent = "離線快取未啟用";
    });
  });
}
