export type QuestionType = "add" | "sub" | "mul1" | "mul2";
export type ModeKey = "sprint" | "survival";

export interface Question {
  text: string;
  answer: number;
  type: QuestionType;
}

export interface StatsSnapshot {
  score: number;
  streak: number;
  totalAnswered: number;
  totalCorrect: number;
}

interface GameState extends StatsSnapshot {
  lives: number | null;
  difficulty: number;
}

interface ModeConfig {
  label: string;
  tag: string;
  subtitle: string;
  hasTimer: boolean;
  startingLives: number | null;
  bestKey: string;
}

export const QUESTION_TYPES: QuestionType[] = ["add", "sub", "mul1", "mul2"];

const MAX_DIFFICULTY = 6;
const SPRINT_TIME_SECONDS = 60;
const BEST_KEY_PREFIX = "numberSenseBest:";
const LEGACY_SPRINT_KEY = "numberSenseSprintBestScore";

const MODES: Record<ModeKey, ModeConfig> = {
  sprint: {
    label: "Sprint",
    tag: "Sprint Mode",
    subtitle: "60-second mental math warm-up",
    hasTimer: true,
    startingLives: null,
    bestKey: `${BEST_KEY_PREFIX}sprint`,
  },
  survival: {
    label: "Survival",
    tag: "Survival Mode",
    subtitle: "3 lives. Questions ramp up in difficulty.",
    hasTimer: false,
    startingLives: 3,
    bestKey: `${BEST_KEY_PREFIX}survival`,
  },
};

function clampDifficulty(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_DIFFICULTY, Math.max(1, Math.floor(value)));
}

function additionRange(difficulty: number): [number, number] {
  const boost = Math.max(0, difficulty - 1);
  const min = 10 + boost * 8;
  const max = 99 + boost * 25;
  return [min, max];
}

function singleDigitRange(difficulty: number): [number, number] {
  const boost = Math.max(0, difficulty - 1);
  const min = 2 + Math.min(boost, 4);
  const max = 9 + Math.min(boost * 2, 8);
  return [min, max];
}

function multiDigitTimesSingleRange(difficulty: number) {
  const boost = Math.max(0, difficulty - 1);
  const firstMin = 10 + boost * 12;
  const firstMax = 99 + boost * 22;
  const secondMin = 2 + Math.min(boost, 3);
  const secondMax = 9 + Math.min(boost, 5);
  return { firstMin, firstMax, secondMin, secondMax };
}

export function randomInt(min: number, max: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function generateQuestion(
  rng: () => number = Math.random,
  forcedType: QuestionType | null = null,
  difficulty: number = 1
): Question {
  const type = forcedType ?? QUESTION_TYPES[randomInt(0, QUESTION_TYPES.length - 1, rng)];
  const level = clampDifficulty(difficulty ?? 1);
  let a: number;
  let b: number;
  let text: string;
  let answer: number;

  switch (type) {
    case "add": {
      const [min, max] = additionRange(level);
      a = randomInt(min, max, rng);
      b = randomInt(min, max, rng);
      text = `${a} + ${b}`;
      answer = a + b;
      break;
    }
    case "sub": {
      const [min, max] = additionRange(level);
      a = randomInt(min, max, rng);
      b = randomInt(min, max, rng);
      if (b > a) {
        [a, b] = [b, a];
      }
      text = `${a} - ${b}`;
      answer = a - b;
      break;
    }
    case "mul1": {
      const [min, max] = singleDigitRange(level);
      a = randomInt(min, max, rng);
      b = randomInt(min, max, rng);
      text = `${a} × ${b}`;
      answer = a * b;
      break;
    }
    case "mul2": {
      const ranges = multiDigitTimesSingleRange(level);
      a = randomInt(ranges.firstMin, ranges.firstMax, rng);
      b = randomInt(ranges.secondMin, ranges.secondMax, rng);
      text = `${a} × ${b}`;
      answer = a * b;
      break;
    }
    default:
      a = 1;
      b = 1;
      text = "1 + 1";
      answer = 2;
  }

  return { text, answer, type };
}

export function parseIntegerAnswer(rawInput: unknown): number | null {
  const normalized = rawInput?.toString().trim();
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  return value;
}

export function evaluateAnswer(
  rawInput: unknown,
  currentQuestion: Question | null,
  stats: Partial<StatsSnapshot>
): { status: "invalid" | "correct" | "wrong"; parsedAnswer: number | null; stats: StatsSnapshot } {
  const parsedAnswer = parseIntegerAnswer(rawInput);
  const baseStats: StatsSnapshot = {
    score: stats.score ?? 0,
    streak: stats.streak ?? 0,
    totalAnswered: stats.totalAnswered ?? 0,
    totalCorrect: stats.totalCorrect ?? 0,
  };

  if (parsedAnswer === null || !currentQuestion) {
    return { status: "invalid", parsedAnswer, stats: { ...baseStats } };
  }

  const isCorrect = parsedAnswer === currentQuestion.answer;
  const updatedStats: StatsSnapshot = { ...baseStats, totalAnswered: baseStats.totalAnswered + 1 };

  if (isCorrect) {
    updatedStats.score += 1;
    updatedStats.streak += 1;
    updatedStats.totalCorrect += 1;
    return { status: "correct", parsedAnswer, stats: updatedStats };
  }

  updatedStats.streak = 0;
  return { status: "wrong", parsedAnswer, stats: updatedStats };
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

function initializeGame(): void {
  const scoreEl = getElement<HTMLElement>("score");
  const streakEl = getElement<HTMLElement>("streak");
  const bestScoreEl = getElement<HTMLElement>("best-score");
  const timerEl = getElement<HTMLElement>("timer");
  const timerPillEl = getElement<HTMLElement>("timer-pill");
  const livesPillEl = getElement<HTMLElement>("lives-pill");
  const livesCountEl = getElement<HTMLElement>("lives-count");
  const modeTagEl = getElement<HTMLElement>("mode-tag");
  const modeSubtitleEl = getElement<HTMLElement>("mode-subtitle");
  const modeButtons = document.querySelectorAll<HTMLElement>("[data-mode-btn]");
  const questionTextEl = getElement<HTMLElement>("question-text");
  const answerInputEl = getElement<HTMLInputElement>("answer-input");
  const answerForm = getElement<HTMLFormElement>("answer-form");
  const startBtn = getElement<HTMLButtonElement>("start-btn");
  const submitBtn = getElement<HTMLButtonElement>("submit-btn");
  const resetBestBtn = getElement<HTMLButtonElement>("reset-best-btn");
  const feedbackEl = getElement<HTMLElement>("feedback");
  const historyLogEl = getElement<HTMLElement>("history-log");
  const accuracyLabelEl = getElement<HTMLElement>("accuracy-label");

  let currentMode: ModeKey = "sprint";
  let currentQuestion: Question | null = null;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let timeLeft: number | null = SPRINT_TIME_SECONDS;
  let isRunning = false;

  const state: GameState = {
    score: 0,
    streak: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    lives: null,
    difficulty: 1,
  };

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function resetStateForMode() {
    state.score = 0;
    state.streak = 0;
    state.totalAnswered = 0;
    state.totalCorrect = 0;
    state.difficulty = 1;
    state.lives = MODES[currentMode].startingLives;
    timeLeft = MODES[currentMode].hasTimer ? SPRINT_TIME_SECONDS : null;
  }

  function setButtonsForRunning() {
    startBtn.textContent = "Running...";
    startBtn.disabled = true;
    startBtn.classList.add("btn-secondary");
    startBtn.classList.remove("btn-primary");
    submitBtn.disabled = false;
    submitBtn.classList.add("btn-primary");
    submitBtn.classList.remove("btn-secondary");
  }

  function setButtonsForIdle(label = "Start") {
    startBtn.textContent = label;
    startBtn.disabled = false;
    startBtn.classList.add("btn-primary");
    startBtn.classList.remove("btn-secondary");
    submitBtn.disabled = true;
    submitBtn.classList.add("btn-secondary");
    submitBtn.classList.remove("btn-primary");
    answerInputEl.disabled = true;
  }

  function loadBestScore(mode: ModeKey) {
    const key = MODES[mode].bestKey;
    const stored = localStorage.getItem(key);
    const baseBest = stored ? parseInt(stored, 10) || 0 : 0;
    const legacy = mode === "sprint" ? localStorage.getItem(LEGACY_SPRINT_KEY) : null;
    const legacyBest = legacy ? parseInt(legacy, 10) || 0 : 0;
    const best = Math.max(baseBest, legacyBest);
    bestScoreEl.textContent = String(best);
    if (mode === "sprint" && best > baseBest) {
      localStorage.setItem(key, String(best));
    }
  }

  function saveBestScore(mode: ModeKey, newScore: number) {
    const key = MODES[mode].bestKey;
    const stored = localStorage.getItem(key);
    const best = stored ? parseInt(stored, 10) || 0 : 0;
    if (newScore > best) {
      localStorage.setItem(key, String(newScore));
      if (mode === "sprint") {
        localStorage.setItem(LEGACY_SPRINT_KEY, String(newScore));
      }
      bestScoreEl.textContent = String(newScore);
      showFeedback("New personal best!", "correct");
    }
  }

  function updateScoreboard() {
    scoreEl.textContent = String(state.score);
    streakEl.textContent = String(state.streak);
    accuracyLabelEl.textContent = `Score: ${state.totalCorrect} / ${state.totalAnswered}`;
  }

  function clearHistoryIfNeeded() {
    const maxEntries = 25;
    const children = historyLogEl.children;
    while (children.length > maxEntries) {
      historyLogEl.removeChild(children[children.length - 1]);
    }
  }

  function addHistoryEntry(question: string, userAnswer: number, correctAnswer: number, isCorrect: boolean) {
    const div = document.createElement("div");
    div.className = `history-entry ${isCorrect ? "correct" : "wrong"}`;
    if (isCorrect) {
      div.textContent = `[OK] ${question} = ${correctAnswer}`;
    } else {
      div.textContent = `[X] ${question} -> you: ${userAnswer} (correct: ${correctAnswer})`;
    }
    historyLogEl.insertBefore(div, historyLogEl.firstChild);
    clearHistoryIfNeeded();
  }

  function showFeedback(message: string, type: "correct" | "wrong" | "") {
    feedbackEl.textContent = message || "";
    feedbackEl.classList.remove("correct", "wrong");
    if (type) {
      feedbackEl.classList.add(type);
    }
  }

  function updateLivesDisplay() {
    const shouldShowLives = currentMode === "survival";
    livesPillEl.classList.toggle("hidden", !shouldShowLives);
    if (shouldShowLives) {
      livesCountEl.textContent = String(state.lives ?? 0);
    }
  }

  function updateTimerDisplay() {
    const shouldShowTimer = MODES[currentMode].hasTimer;
    timerPillEl.classList.toggle("hidden", !shouldShowTimer);
    if (shouldShowTimer) {
      timerEl.textContent = timeLeft !== null ? `${timeLeft}s` : "--";
    }
  }

  function bumpDifficulty() {
    if (currentMode !== "survival") {
      state.difficulty = 1;
      return;
    }
    const calculated = 1 + Math.floor(state.totalCorrect / 4);
    state.difficulty = clampDifficulty(calculated);
  }

  function nextQuestion() {
    currentQuestion = generateQuestion(Math.random, null, state.difficulty);
    questionTextEl.textContent = currentQuestion.text;
  }

  function updateModeUi() {
    modeTagEl.textContent = MODES[currentMode].tag;
    modeSubtitleEl.textContent = MODES[currentMode].subtitle;
    modeButtons.forEach((btn) => {
      const isActive = btn.dataset.modeBtn === currentMode;
      btn.classList.toggle("active", isActive);
    });
    updateLivesDisplay();
    updateTimerDisplay();
  }

  function startGame() {
    if (isRunning) return;
    isRunning = true;
    resetStateForMode();

    updateScoreboard();
    historyLogEl.innerHTML = "";
    const startMessage =
      currentMode === "sprint"
        ? "Go! 60 seconds on the clock."
        : "Go! You have 3 lives. Difficulty increases as you score.";
    showFeedback(startMessage, "correct");

    setButtonsForRunning();
    answerInputEl.disabled = false;
    answerInputEl.value = "";
    answerInputEl.focus();

    updateLivesDisplay();
    updateTimerDisplay();
    nextQuestion();

    if (MODES[currentMode].hasTimer) {
      stopTimer();
      timerId = setInterval(() => {
        timeLeft = (timeLeft ?? 0) - 1;
        if (timeLeft <= 0) {
          timeLeft = 0;
          updateTimerDisplay();
          endGame("time");
        } else {
          updateTimerDisplay();
        }
      }, 1000);
    }
  }

  function endGame(reason: "time" | "out_of_lives" | "manual" = "time") {
    if (!isRunning) return;
    isRunning = false;
    stopTimer();

    setButtonsForIdle("Play Again");
    updateTimerDisplay();

    let message = "";
    if (currentMode === "sprint") {
      message = `Time! Final score: ${state.score} | Score: ${state.totalCorrect}/${state.totalAnswered}`;
    } else if (reason === "out_of_lives") {
      message = `Out of lives! Final score: ${state.score} | Correct: ${state.totalCorrect}/${state.totalAnswered}`;
    } else {
      message = `Final score: ${state.score} | Correct: ${state.totalCorrect}/${state.totalAnswered}`;
    }
    showFeedback(message, "");
    saveBestScore(currentMode, state.score);
  }

  function handleAnswerSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!isRunning || !currentQuestion) {
      return;
    }

    const result = evaluateAnswer(answerInputEl.value, currentQuestion, state);

    if (result.status === "invalid") {
      showFeedback("Please enter a whole number.", "wrong");
      answerInputEl.focus();
      return;
    }

    Object.assign(state, result.stats);

    if (result.status === "correct") {
      showFeedback("Correct!", "correct");
      addHistoryEntry(currentQuestion.text, result.parsedAnswer ?? 0, currentQuestion.answer, true);
    } else {
      showFeedback(`Missed: ${currentQuestion.text} = ${currentQuestion.answer}`, "wrong");
      addHistoryEntry(currentQuestion.text, result.parsedAnswer ?? 0, currentQuestion.answer, false);
      if (currentMode === "survival") {
        state.lives = Math.max(0, (state.lives ?? 0) - 1);
        updateLivesDisplay();
        if (state.lives <= 0) {
          endGame("out_of_lives");
          return;
        }
      }
    }

    updateScoreboard();
    bumpDifficulty();
    answerInputEl.value = "";
    answerInputEl.focus();

    if (MODES[currentMode].hasTimer && timeLeft !== null && timeLeft <= 0) {
      endGame("time");
    } else if (currentMode === "survival" && (state.lives ?? 0) <= 0) {
      endGame("out_of_lives");
    } else {
      nextQuestion();
    }
  }

  function resetBestScore() {
    localStorage.removeItem(MODES[currentMode].bestKey);
    bestScoreEl.textContent = "0";
    showFeedback("Best score reset for this mode.", "");
  }

  function switchMode(newMode: ModeKey) {
    if (!MODES[newMode] || newMode === currentMode) return;
    stopTimer();
    isRunning = false;
    currentMode = newMode;
    resetStateForMode();
    updateModeUi();
    loadBestScore(currentMode);
    updateScoreboard();
    setButtonsForIdle("Start");
    questionTextEl.textContent = "Press Start";
    historyLogEl.innerHTML = "";
    showFeedback(`Switched to ${MODES[currentMode].label}. Press Start to play.`, "");
  }

  startBtn.addEventListener("click", startGame);
  answerForm.addEventListener("submit", handleAnswerSubmit);
  resetBestBtn.addEventListener("click", resetBestScore);
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.modeBtn as ModeKey | undefined;
      if (mode) {
        switchMode(mode);
      }
    });
  });

  loadBestScore(currentMode);
  updateModeUi();
  setButtonsForIdle("Start");
  answerInputEl.value = "";
  updateScoreboard();
}

if (typeof document !== "undefined") {
  initializeGame();
}
