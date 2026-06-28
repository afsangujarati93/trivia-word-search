"use strict";

const PUZZLE_VERSION = "v1";
const GOOGLE_SHEET_ID = "1uJr0ch0_kONu8HPw9mfU5hUSZ19qjNWmjZzpLtlpUAY";
const GOOGLE_SHEET_GID = "0";
const GOOGLE_SHEETS_WEB_APP_URL = "";

const GAME_SECONDS = 90;
const SHEET_READ_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?gid=${GOOGLE_SHEET_GID}&headers=1&tqx=out:json;responseHandler:`;

const DEFAULT_SCORES = [
  { name: "Maya", scoreSeconds: 53.4, completed: true },
  { name: "Arjun", scoreSeconds: 56.1, completed: true },
  { name: "Neha", scoreSeconds: 58.7, completed: true },
  { name: "Rohan", scoreSeconds: 59.2, completed: true }
];

const CLUES = [
  {
    id: 1,
    clue: "Which green messaging app is famous for groups and voice notes?",
    answer: "WHATSAPP",
    aliases: ["WHATAPP", "WHAT'SAPP", "WHAT'S APP", "WA"]
  },
  {
    id: 2,
    clue: "Where do people go to borrow books?",
    answer: "LIBRARY",
    aliases: ["A LIBRARY"]
  },
  {
    id: 3,
    clue: "Which Indian city is known as the home of Bollywood?",
    answer: "MUMBAI",
    aliases: ["BOMBAY"]
  },
  {
    id: 4,
    clue: "Quick math: 12 + 8 = ?",
    answer: "TWENTY",
    aliases: ["20", "TWENTY"]
  },
  {
    id: 5,
    clue: "Which season is known for hot weather?",
    answer: "SUMMER",
    aliases: []
  },
  {
    id: 6,
    clue: "Which company makes the iPhone?",
    answer: "APPLE",
    aliases: ["APPLE INC", "APPLE INC."]
  },
  {
    id: 7,
    clue: "How many days are in a week?",
    answer: "SEVEN",
    aliases: ["7"]
  }
];

const ANSWER_PATHS = {
  WHATSAPP: [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 7],
    [1, 8]
  ],
  LIBRARY: [
    [3, 10],
    [4, 10],
    [5, 10],
    [6, 10],
    [7, 10],
    [8, 10],
    [9, 10]
  ],
  MUMBAI: [
    [3, 6],
    [3, 5],
    [3, 4],
    [3, 3],
    [3, 2],
    [3, 1]
  ],
  TWENTY: [
    [7, 6],
    [7, 5],
    [7, 4],
    [7, 3],
    [7, 2],
    [7, 1]
  ],
  SUMMER: [
    [11, 0],
    [10, 0],
    [9, 0],
    [8, 0],
    [7, 0],
    [6, 0]
  ],
  APPLE: [
    [0, 11],
    [1, 10],
    [2, 9],
    [3, 8],
    [4, 7]
  ],
  SEVEN: [
    [10, 6],
    [10, 7],
    [10, 8],
    [10, 9],
    [10, 10]
  ]
};

const REVEAL_WORD_PATHS = {
  BABY: [
    [8, 3],
    [9, 3],
    [10, 3],
    [11, 3]
  ],
  INCOMING: [
    [3, 11],
    [4, 11],
    [5, 11],
    [6, 11],
    [7, 11],
    [8, 11],
    [9, 11],
    [10, 11]
  ]
};

const REVEAL_PATH = Object.values(REVEAL_WORD_PATHS).flat();

const BASE_GRID = [
  "MORBQABNLOQA",
  "DWHATSPPJKPR",
  "FQMDAEOYIPUZ",
  "NCGBTOGZLHLK",
  "APJEAKREANIX",
  "ZRYVOILNQCBT",
  "RHQCPXWNKNRD",
  "EYTNEWTGYFAL",
  "MUXQDZVPIOFM",
  "MQVCGTPWINYL",
  "UDBKOHSEVENC",
  "SPLATGNODKEM"
];

let state = {
  playerName: "",
  startedAt: 0,
  timerId: null,
  remaining: GAME_SECONDS,
  solved: new Set(),
  selection: [],
  isPointerDown: false,
  pointerDownCell: null,
  dragStarted: false,
  isRevealed: false,
  isFinishing: false,
  completedAt: 0,
  pendingAttempt: null,
  currentAttemptId: ""
};

let remoteScores = [];
let hasLoadedRemoteScores = false;
let remoteScorePromise = null;
let currentAttempt = null;
let confettiTimerId = null;

const elements = {
  landing: document.getElementById("landing-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
  startForm: document.getElementById("start-form"),
  playerNameInput: document.getElementById("player-name"),
  gameTitle: document.getElementById("game-title"),
  timer: document.getElementById("timer"),
  timerBox: document.querySelector(".timer-box"),
  progressText: document.getElementById("progress-text"),
  progressFill: document.getElementById("progress-fill"),
  grid: document.getElementById("word-grid"),
  clueList: document.getElementById("clue-list"),
  selectionStatus: document.getElementById("selection-status"),
  clearSelection: document.getElementById("clear-selection"),
  landingLeaderboard: document.getElementById("landing-leaderboard"),
  bestScore: document.getElementById("best-score"),
  confettiLayer: document.getElementById("confetti-layer")
};

function normalizeWord(value) {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function reverse(value) {
  return value.split("").reverse().join("");
}

function coordKey(row, col) {
  return `${row}-${col}`;
}

function buildGridLetters() {
  const grid = BASE_GRID.map((row) => row.split(""));
  Object.entries(ANSWER_PATHS).forEach(([answer, path]) => {
    path.forEach(([row, col], index) => {
      grid[row][col] = answer[index];
    });
  });

  Object.entries(REVEAL_WORD_PATHS).forEach(([word, path]) => {
    word.split("").forEach((letter, index) => {
      const [row, col] = path[index];
      grid[row][col] = letter;
    });
  });

  return grid;
}

const GRID_LETTERS = buildGridLetters();

function readLeaderboard() {
  const seeded = DEFAULT_SCORES.map((entry, index) => ({
    solvedCount: 7,
    durationSeconds: entry.scoreSeconds,
    revealedBy: "completed",
    puzzleVersion: PUZZLE_VERSION,
    createdAt: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
    attemptId: `seed-${index + 1}`,
    ...entry
  }));

  const baseScores = hasLoadedRemoteScores && remoteScores.length ? remoteScores : seeded;
  const entriesById = new Map();
  baseScores.forEach((entry) => {
    entriesById.set(entry.attemptId || `${entry.name}-${entry.createdAt}`, entry);
  });

  if (currentAttempt && !entriesById.has(currentAttempt.attemptId)) {
    entriesById.set(currentAttempt.attemptId, currentAttempt);
  }

  return [...entriesById.values()];
}

function loadRemoteScores(force = false) {
  if (remoteScorePromise && !force) {
    return remoteScorePromise;
  }

  remoteScorePromise = new Promise((resolve) => {
    const callbackName = `handleSheetScores_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (response) => {
      try {
        remoteScores = parseSheetResponse(response);
        hasLoadedRemoteScores = true;
      } catch (error) {
        console.warn("Could not parse Google Sheet scores.", error);
      } finally {
        cleanup();
        resolve(remoteScores);
      }
    };

    script.onerror = () => {
      cleanup();
      resolve([]);
    };
    script.src = `${SHEET_READ_URL}${callbackName}&cachebust=${Date.now()}`;
    document.head.appendChild(script);
  });

  return remoteScorePromise;
}

function parseSheetResponse(response) {
  const table = response && response.table;
  if (!table || !Array.isArray(table.rows)) {
    return [];
  }

  const headers = table.cols.map((col) => normalizeHeader(col.label || col.id || ""));
  return table.rows
    .map((row) => {
      const values = row.c || [];
      const data = {};
      headers.forEach((header, index) => {
        if (!header) {
          return;
        }
        data[header] = values[index] ? values[index].v : "";
      });
      return sheetRowToAttempt(data);
    })
    .filter((entry) => entry && entry.revealedBy !== "started")
    .filter(Boolean);
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "_");
}

function sheetRowToAttempt(row) {
  const name = String(row.name || "").trim();
  if (!name) {
    return null;
  }

  const completed = parseBoolean(row.completed);
  const durationSeconds = parseNumber(row.duration_seconds, completed ? row.score_seconds : GAME_SECONDS);
  const scoreSeconds = parseNumber(row.score_seconds, completed ? durationSeconds : GAME_SECONDS);
  const solvedCount = parseNumber(row.solved_count, completed ? 7 : 0);

  return {
    name,
    scoreSeconds,
    completed,
    solvedCount,
    durationSeconds,
    revealedBy: String(row.revealed_by || (completed ? "completed" : "timeout")),
    puzzleVersion: String(row.puzzle_version || PUZZLE_VERSION),
    createdAt: String(row.created_at || ""),
    userAgent: String(row.user_agent || ""),
    attemptId: String(row.attempt_id || `${name}-${row.created_at || Math.random()}`)
  };
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  return String(value).trim().toLowerCase() === "true";
}

function parseNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number(fallback);
}

function saveAttempt(attempt) {
  currentAttempt = attempt;

  if (GOOGLE_SHEETS_WEB_APP_URL.trim()) {
    const sheetPayload = toSheetPayload(attempt);
    fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(sheetPayload)
    }).catch((error) => {
      console.warn("Score sync failed.", error);
    });
    scheduleSheetRefresh();
  } else {
    console.warn("Set GOOGLE_SHEETS_WEB_APP_URL to an Apps Script Web App /exec URL to write attempts to Google Sheets.");
  }
}

function toSheetPayload(attempt) {
  return {
    name: attempt.name,
    scoreSeconds: attempt.scoreSeconds,
    score_seconds: attempt.scoreSeconds,
    completed: attempt.completed,
    solvedCount: attempt.solvedCount,
    solved_count: attempt.solvedCount,
    durationSeconds: attempt.durationSeconds,
    duration_seconds: attempt.durationSeconds,
    revealedBy: attempt.revealedBy,
    revealed_by: attempt.revealedBy,
    puzzleVersion: attempt.puzzleVersion,
    puzzle_version: attempt.puzzleVersion,
    createdAt: attempt.createdAt,
    created_at: attempt.createdAt,
    userAgent: attempt.userAgent,
    user_agent: attempt.userAgent,
    attemptId: attempt.attemptId,
    attempt_id: attempt.attemptId
  };
}

function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? -1 : 1;
    }
    if (a.completed && b.completed) {
      return a.scoreSeconds - b.scoreSeconds;
    }
    if ((b.solvedCount || 0) !== (a.solvedCount || 0)) {
      return (b.solvedCount || 0) - (a.solvedCount || 0);
    }
    return (a.durationSeconds || GAME_SECONDS) - (b.durationSeconds || GAME_SECONDS);
  });
}

function formatScore(entry) {
  if (entry.completed) {
    return `${Number(entry.scoreSeconds).toFixed(1)}s`;
  }
  return `${entry.solvedCount || 0}/7`;
}

function renderLeaderboard(target, limit = 6, includeCurrentAttempt = false) {
  const sortedEntries = sortLeaderboard(readLeaderboard());
  const visibleEntries = sortedEntries.slice(0, limit).map((entry, index) => ({
    entry,
    rank: index + 1
  }));

  if (includeCurrentAttempt && state.currentAttemptId) {
    const currentIndex = sortedEntries.findIndex((entry) => entry.attemptId === state.currentAttemptId);
    const isCurrentVisible = visibleEntries.some(({ entry }) => entry.attemptId === state.currentAttemptId);
    if (currentIndex >= 0 && !isCurrentVisible) {
      visibleEntries.push({
        entry: sortedEntries[currentIndex],
        rank: currentIndex + 1
      });
    }
  }

  target.innerHTML = "";
  visibleEntries.forEach(({ entry, rank }) => {
    const item = document.createElement("li");
    if (entry.attemptId && entry.attemptId === state.currentAttemptId) {
      item.classList.add("is-current-player");
    }
    item.innerHTML = `
      <span class="rank">${rank}</span>
      <span class="name"></span>
      <span class="score">${formatScore(entry)}</span>
    `;
    item.querySelector(".name").textContent = entry.name;
    target.appendChild(item);
  });

  const bestCompleted = sortedEntries.find((entry) => entry.completed);
  if (target === elements.landingLeaderboard && bestCompleted) {
    elements.bestScore.textContent = `Best score: ${Number(bestCompleted.scoreSeconds).toFixed(1)}s`;
  }
}

function refreshLeaderboards() {
  renderLeaderboard(elements.landingLeaderboard, 4);
}

function scheduleSheetRefresh() {
  [1200, 3000, 6000].forEach((delay) => {
    window.setTimeout(() => {
      loadRemoteScores(true).then(() => {
        const resultLeaderboard = document.getElementById("result-leaderboard");
        if (resultLeaderboard) {
          renderLeaderboard(resultLeaderboard, 8, true);
        }
        refreshLeaderboards();
      });
    }, delay);
  });
}

function renderClues() {
  elements.clueList.innerHTML = "";
  CLUES.forEach((item) => {
    const clue = document.createElement("li");
    clue.id = `clue-${item.id}`;
    clue.textContent = item.clue;
    elements.clueList.appendChild(clue);
  });
}

function renderGrid(target = elements.grid, includeRevealState = false) {
  target.innerHTML = "";
  GRID_LETTERS.forEach((rowLetters, row) => {
    rowLetters.forEach((letter, col) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.textContent = letter;
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}, letter ${letter}`);

      const key = coordKey(row, col);
      if (isFoundCell(key)) {
        cell.classList.add("is-found");
      }
      if (includeRevealState && !isRevealCell(key)) {
        cell.classList.add("is-dimmed");
      }
      if (includeRevealState && isRevealCell(key)) {
        cell.classList.add("is-reveal");
        cell.dataset.revealWord = getRevealWordForCell(key);
      }

      target.appendChild(cell);
    });
  });
}

function isFoundCell(key) {
  for (const answer of state.solved) {
    if (ANSWER_PATHS[answer].some(([row, col]) => coordKey(row, col) === key)) {
      return true;
    }
  }
  return false;
}

function isRevealCell(key) {
  return REVEAL_PATH.some(([row, col]) => coordKey(row, col) === key);
}

function getRevealWordForCell(key) {
  const entry = Object.entries(REVEAL_WORD_PATHS).find(([, path]) => {
    return path.some(([row, col]) => coordKey(row, col) === key);
  });
  return entry ? entry[0] : "";
}

function showScreen(screen) {
  [elements.landing, elements.game, elements.result].forEach((item) => {
    item.classList.toggle("is-active", item === screen);
  });
}

function updateProgress() {
  const foundCount = state.solved.size;
  elements.progressText.textContent = `${foundCount} / ${CLUES.length} found`;
  elements.progressFill.style.width = `${(foundCount / CLUES.length) * 100}%`;
}

function updateTimer() {
  const elapsed = (performance.now() - state.startedAt) / 1000;
  state.remaining = Math.max(0, GAME_SECONDS - elapsed);
  elements.timer.textContent = state.remaining.toFixed(1);
  elements.timerBox.classList.toggle("is-low", state.remaining <= 10);

  if (state.remaining <= 0) {
    finishGame("timeout");
  }
}

function startTimer() {
  clearInterval(state.timerId);
  state.startedAt = performance.now();
  updateTimer();
  state.timerId = setInterval(updateTimer, 100);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function startGame(name) {
  clearConfetti();
  const attemptId = makeAttemptId();
  state = {
    playerName: name,
    startedAt: 0,
    timerId: null,
    remaining: GAME_SECONDS,
    solved: new Set(),
    selection: [],
    isPointerDown: false,
    pointerDownCell: null,
    dragStarted: false,
    isRevealed: false,
    isFinishing: false,
    completedAt: 0,
    pendingAttempt: null,
    currentAttemptId: attemptId
  };

  elements.gameTitle.textContent = name;
  elements.timerBox.classList.remove("is-low");
  elements.selectionStatus.textContent = "Tap or drag across letters.";
  renderClues();
  renderGrid();
  updateProgress();
  showScreen(elements.game);
  startTimer();
  saveAttempt(createAttempt("started"));
}

function getCellFromEvent(event) {
  const target = event.target.closest(".cell");
  if (!target || !elements.grid.contains(target)) {
    return null;
  }
  return {
    row: Number(target.dataset.row),
    col: Number(target.dataset.col),
    element: target
  };
}

function getCellFromPoint(event) {
  const point = event.touches ? event.touches[0] : event;
  if (!point) {
    return null;
  }
  const element = document.elementFromPoint(point.clientX, point.clientY);
  if (!element) {
    return null;
  }
  const cell = element.closest(".cell");
  if (!cell || !elements.grid.contains(cell)) {
    return null;
  }
  return {
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
    element: cell
  };
}

function pathBetween(start, end) {
  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  const rowDistance = Math.abs(rowDelta);
  const colDistance = Math.abs(colDelta);

  if (rowDistance !== 0 && colDistance !== 0 && rowDistance !== colDistance) {
    return null;
  }

  const length = Math.max(rowDistance, colDistance) + 1;
  const path = [];
  for (let index = 0; index < length; index += 1) {
    path.push({
      row: start.row + rowStep * index,
      col: start.col + colStep * index
    });
  }
  return path;
}

function addCellToSelection(cell) {
  if (state.isRevealed || state.isFinishing) {
    return;
  }

  const key = coordKey(cell.row, cell.col);
  if (state.selection.some((item) => coordKey(item.row, item.col) === key)) {
    return;
  }

  if (state.selection.length === 1) {
    const path = pathBetween(state.selection[0], cell);
    if (path && path.length > 1) {
      state.selection = path;
      paintSelection();
      checkSelection();
      return;
    }
  }

  state.selection.push({ row: cell.row, col: cell.col });
  paintSelection();
  checkSelection();
}

function paintSelection() {
  elements.grid.querySelectorAll(".cell").forEach((cell) => {
    const key = coordKey(Number(cell.dataset.row), Number(cell.dataset.col));
    const isSelected = state.selection.some((item) => coordKey(item.row, item.col) === key);
    cell.classList.toggle("is-selected", isSelected);
    cell.classList.toggle("is-found", isFoundCell(key));
  });

  const selectedWord = getSelectedWord();
  elements.selectionStatus.textContent = selectedWord
    ? `Selected: ${selectedWord}`
    : "Tap or drag across letters.";
}

function getSelectedWord() {
  return state.selection.map(({ row, col }) => GRID_LETTERS[row][col]).join("");
}

function answerMatchesSelection(item, selectedWord) {
  const normalizedSelected = normalizeWord(selectedWord);
  const candidates = [item.answer, ...item.aliases].map(normalizeWord);
  return candidates.some((candidate) => {
    return normalizedSelected === candidate || normalizedSelected === reverse(candidate);
  });
}

function checkSelection() {
  const selectedWord = getSelectedWord();
  if (!selectedWord) {
    return;
  }

  const found = CLUES.find((item) => {
    return !state.solved.has(item.answer) && answerMatchesSelection(item, selectedWord);
  });

  if (found) {
    markFound(found.answer, found.id);
    return;
  }

  const maxAnswerLength = Math.max(...CLUES.map((item) => normalizeWord(item.answer).length));
  if (selectedWord.length > maxAnswerLength) {
    shakeGrid();
    clearSelection();
  }
}

function markFound(answer, clueId) {
  state.solved.add(answer);
  const clue = document.getElementById(`clue-${clueId}`);
  if (clue) {
    clue.classList.add("is-solved");
  }

  elements.selectionStatus.textContent = `${answer} found`;
  state.selection = [];
  paintSelection();
  updateProgress();

  if (state.solved.size === CLUES.length) {
    state.isFinishing = true;
    state.completedAt = performance.now();
    stopTimer();
    elements.selectionStatus.textContent = "Nice. Loading the final board...";
    window.setTimeout(() => {
      finishGame("completed");
    }, 1000);
  }
}

function clearSelection() {
  state.selection = [];
  paintSelection();
}

function shakeGrid() {
  elements.grid.classList.remove("is-shaking");
  void elements.grid.offsetWidth;
  elements.grid.classList.add("is-shaking");
}

function createAttempt(revealedBy) {
  const endTime = revealedBy === "completed" && state.completedAt ? state.completedAt : performance.now();
  const elapsed = state.startedAt
    ? Math.min(GAME_SECONDS, (endTime - state.startedAt) / 1000)
    : 0;
  const completed = revealedBy === "completed";
  const durationSeconds = Number(elapsed.toFixed(1));

  return {
    name: state.playerName,
    scoreSeconds: completed ? durationSeconds : GAME_SECONDS,
    completed,
    solvedCount: state.solved.size,
    durationSeconds,
    revealedBy,
    puzzleVersion: PUZZLE_VERSION,
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    attemptId: state.currentAttemptId || makeAttemptId()
  };
}

function makeAttemptId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `attempt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function finishGame(reason) {
  if (state.isRevealed) {
    return;
  }
  stopTimer();

  const attempt = createAttempt(reason);
  saveAttempt(attempt);

  if (reason === "timeout") {
    state.pendingAttempt = attempt;
    renderTimeoutPopup(attempt);
    return;
  }

  state.isRevealed = true;
  renderResult(reason, attempt);
  showScreen(elements.result);
  animateReveal();
  launchConfetti();
}

function renderTimeoutPopup(attempt) {
  const popup = document.createElement("div");
  popup.className = "timeout-overlay";
  popup.innerHTML = `
    <div class="timeout-modal" role="dialog" aria-modal="true" aria-labelledby="timeout-title">
      <h2 id="timeout-title">Time's up</h2>
      <p>You may not be great at puzzles, but we hope you're great at changing diapers.</p>
      <button id="show-reveal" type="button" class="primary-button">Show the puzzle</button>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById("show-reveal").focus();
  document.getElementById("show-reveal").addEventListener("click", () => {
    popup.remove();
    revealTimeoutAttempt(attempt);
  });
}

function revealTimeoutAttempt(attempt) {
  if (state.isRevealed) {
    return;
  }
  state.isRevealed = true;
  renderResult("timeout", attempt);
  showScreen(elements.result);
  animateReveal();
  launchConfetti();
}

function renderResult(reason, attempt) {
  const completed = reason === "completed";
  const foundCopy = completed ? "" : `You found ${attempt.solvedCount} out of ${CLUES.length} words.`;
  const resultCopy = completed
    ? `You finished in ${attempt.durationSeconds.toFixed(1)}s.`
    : foundCopy;

  elements.result.innerHTML = `
    <div class="result-card announcement-mode">
      <section class="reveal-card" aria-label="Baby announcement">
        <span class="reveal-shape shape-star" aria-hidden="true"></span>
        <span class="reveal-shape shape-dot" aria-hidden="true"></span>
        <span class="reveal-shape shape-moon" aria-hidden="true"></span>
        <p class="reveal-eyebrow">Good job solving the puzzle. Now get ready to change diapers.</p>
        <h2 class="reveal-headline">Tiny Feet, Big News</h2>
        <div class="reveal-divider" aria-hidden="true"><span></span></div>
        <p class="reveal-subline">Tazbin &amp; Afsan — Dec 2026</p>
      </section>
      ${resultCopy ? `<p class="result-meta reveal-score">${resultCopy}</p>` : ""}
      <div class="result-grid-wrap">
        <div id="result-grid" class="word-grid" aria-label="Completed word-search grid"></div>
      </div>
      <div class="leaderboard-card result-leaderboard">
        <div class="card-title-row">
          <h2>Leaderboard</h2>
          <span>Updated</span>
        </div>
        <ol id="result-leaderboard" class="leaderboard-list"></ol>
      </div>
    </div>
  `;

  renderGrid(document.getElementById("result-grid"), true);
  renderLeaderboard(document.getElementById("result-leaderboard"), 8, true);
}

function animateReveal() {
  const resultCells = document.querySelectorAll("#result-grid .cell.is-reveal");
  resultCells.forEach((cell) => {
    cell.style.animationDelay = "0ms, 900ms";
  });
}

function launchConfetti() {
  clearConfetti();
  const colors = ["#b45309", "#f59e0b", "#f4ca64", "#5f6f34", "#ffffff", "#ef4444"];
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti is-floating";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = `${8 + Math.random() * 76}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 2200}ms`;
    piece.style.setProperty("--float-x", `${Math.random() * 42 - 21}px`);
    elements.confettiLayer.appendChild(piece);
  }

  const createWave = () => {
    const wavePieces = [];
    for (let index = 0; index < 34; index += 1) {
      const piece = document.createElement("span");
      piece.className = index % 5 === 0 ? "confetti is-streamer" : "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[index % colors.length];
      piece.style.animationDelay = `${Math.random() * 380}ms`;
      piece.style.setProperty("--drift", `${Math.random() * 140 - 70}px`);
      elements.confettiLayer.appendChild(piece);
      wavePieces.push(piece);
    }

    for (let index = 0; index < 30; index += 1) {
      const piece = document.createElement("span");
      const fromLeft = index % 2 === 0;
      piece.className = "confetti is-burst";
      piece.style.left = fromLeft ? "13%" : "87%";
      piece.style.background = colors[(index + 2) % colors.length];
      piece.style.animationDelay = `${Math.random() * 160}ms`;
      piece.style.setProperty("--burst-x", `${(fromLeft ? 1 : -1) * (50 + Math.random() * 260)}px`);
      piece.style.setProperty("--burst-y", `${-40 - Math.random() * 300}px`);
      elements.confettiLayer.appendChild(piece);
      wavePieces.push(piece);
    }

    window.setTimeout(() => {
      wavePieces.forEach((piece) => piece.remove());
    }, 3400);
  };

  createWave();
  confettiTimerId = window.setInterval(createWave, 950);
}

function clearConfetti() {
  if (confettiTimerId) {
    window.clearInterval(confettiTimerId);
    confettiTimerId = null;
  }
  elements.confettiLayer.innerHTML = "";
}

elements.startForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.playerNameInput.value.trim() || "Player";
  startGame(name.slice(0, 18));
});

elements.clearSelection.addEventListener("click", clearSelection);

elements.grid.addEventListener("pointerdown", (event) => {
  const cell = getCellFromEvent(event);
  if (!cell) {
    return;
  }
  state.isPointerDown = true;
  state.pointerDownCell = cell;
  state.dragStarted = false;
});

elements.grid.addEventListener("pointermove", (event) => {
  if (!state.isPointerDown) {
    return;
  }
  const cell = getCellFromPoint(event);
  if (cell) {
    if (!state.dragStarted) {
      state.selection = [];
      addCellToSelection(state.pointerDownCell);
      state.dragStarted = true;
    }
    addCellToSelection(cell);
  }
});

window.addEventListener("pointerup", () => {
  state.isPointerDown = false;
  state.pointerDownCell = null;
});

elements.grid.addEventListener("click", (event) => {
  const cell = getCellFromEvent(event);
  if (!cell) {
    return;
  }
  if (state.dragStarted) {
    state.dragStarted = false;
    return;
  }
  addCellToSelection(cell);
});

refreshLeaderboards();
loadRemoteScores().then(refreshLeaderboards);
renderClues();
renderGrid();
