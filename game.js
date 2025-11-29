export const QUESTION_TYPES = ["add", "sub", "mul1", "mul2"];

export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function generateQuestion(rng = Math.random, forcedType = null) {
  const type = forcedType ?? QUESTION_TYPES[randomInt(0, QUESTION_TYPES.length - 1, rng)];
  let a;
  let b;
  let text;
  let answer;

  switch (type) {
    case "add":
      a = randomInt(10, 99, rng);
      b = randomInt(10, 99, rng);
      text = `${a} + ${b}`;
      answer = a + b;
      break;
    case "sub":
      a = randomInt(10, 99, rng);
      b = randomInt(10, 99, rng);
      if (b > a) {
        [a, b] = [b, a];
      }
      text = `${a} - ${b}`;
      answer = a - b;
      break;
    case "mul1":
      a = randomInt(2, 9, rng);
      b = randomInt(2, 9, rng);
      text = `${a} × ${b}`;
      answer = a * b;
      break;
    case "mul2":
      a = randomInt(10, 99, rng);
      b = randomInt(2, 9, rng);
      text = `${a} × ${b}`;
      answer = a * b;
      break;
    default:
      a = 1;
      b = 1;
      text = "1 + 1";
      answer = 2;
  }

  return { text, answer, type };
}

export function parseIntegerAnswer(rawInput) {
  const normalized = rawInput?.toString().trim();
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  return value;
}

export function evaluateAnswer(rawInput, currentQuestion, stats) {
  const parsedAnswer = parseIntegerAnswer(rawInput);
  const baseStats = {
    score: stats.score || 0,
    streak: stats.streak || 0,
    totalAnswered: stats.totalAnswered || 0,
    totalCorrect: stats.totalCorrect || 0,
  };

  if (parsedAnswer === null || !currentQuestion) {
    return { status: "invalid", parsedAnswer, stats: { ...baseStats } };
  }

  const isCorrect = parsedAnswer === currentQuestion.answer;
  const updatedStats = { ...baseStats, totalAnswered: baseStats.totalAnswered + 1 };

  if (isCorrect) {
    updatedStats.score += 1;
    updatedStats.streak += 1;
    updatedStats.totalCorrect += 1;
    return { status: "correct", parsedAnswer, stats: updatedStats };
  }

  updatedStats.streak = 0;
  return { status: "wrong", parsedAnswer, stats: updatedStats };
}

function initializeGame() {
  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");
  const bestScoreEl = document.getElementById("best-score");
  const timerEl = document.getElementById("timer");
  const questionTextEl = document.getElementById("question-text");
  const answerInputEl = document.getElementById("answer-input");
  const answerForm = document.getElementById("answer-form");
  const startBtn = document.getElementById("start-btn");
  const resetBestBtn = document.getElementById("reset-best-btn");
  const feedbackEl = document.getElementById("feedback");
  const historyLogEl = document.getElementById("history-log");
  const accuracyLabelEl = document.getElementById("accuracy-label");

  let currentQuestion = null;
  let timerId = null;
  let timeLeft = 60;
  let isRunning = false;

  const state = {
    score: 0,
    streak: 0,
    totalAnswered: 0,
    totalCorrect: 0,
  };

  const BEST_KEY = "numberSenseSprintBestScore";

  function loadBestScore() {
    const stored = localStorage.getItem(BEST_KEY);
    const best = stored ? parseInt(stored, 10) || 0 : 0;
    bestScoreEl.textContent = best;
  }

  function saveBestScore(newScore) {
    const stored = localStorage.getItem(BEST_KEY);
    const best = stored ? parseInt(stored, 10) || 0 : 0;
    if (newScore > best) {
      localStorage.setItem(BEST_KEY, String(newScore));
      bestScoreEl.textContent = newScore;
      showFeedback("🎉 New personal best!", "correct");
    }
  }

  function updateScoreboard() {
    scoreEl.textContent = state.score;
    streakEl.textContent = state.streak;
    accuracyLabelEl.textContent = `Score: ${state.totalCorrect} / ${state.totalAnswered}`;
  }

  function clearHistoryIfNeeded() {
    const maxEntries = 25;
    const children = historyLogEl.children;
    while (children.length > maxEntries) {
      historyLogEl.removeChild(children[children.length - 1]);
    }
  }

  function addHistoryEntry(question, userAnswer, correctAnswer, isCorrect) {
    const div = document.createElement("div");
    div.className = `history-entry ${isCorrect ? "correct" : "wrong"}`;
    if (isCorrect) {
      div.textContent = `✓ ${question} = ${correctAnswer}`;
    } else {
      div.textContent = `✗ ${question} → you: ${userAnswer} (correct: ${correctAnswer})`;
    }
    historyLogEl.insertBefore(div, historyLogEl.firstChild);
    clearHistoryIfNeeded();
  }

  function showFeedback(message, type) {
    feedbackEl.textContent = message || "";
    feedbackEl.classList.remove("correct", "wrong");
    if (type) {
      feedbackEl.classList.add(type);
    }
  }

  function startGame() {
    if (isRunning) return;
    isRunning = true;
    state.score = 0;
    state.streak = 0;
    state.totalAnswered = 0;
    state.totalCorrect = 0;
    timeLeft = 60;

    updateScoreboard();
    timerEl.textContent = `${timeLeft}s`;
    historyLogEl.innerHTML = "";
    showFeedback("Go! Type your answer and press Enter.", "correct");

    startBtn.textContent = "Running...";
    startBtn.disabled = true;
    startBtn.classList.add("btn-secondary");
    startBtn.classList.remove("btn-primary");

    currentQuestion = generateQuestion();
    questionTextEl.textContent = currentQuestion.text;
    answerInputEl.disabled = false;
    answerInputEl.value = "";
    answerInputEl.focus();

    if (timerId) {
      clearInterval(timerId);
    }
    timerId = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timerEl.textContent = "0s";
        endGame();
      } else {
        timerEl.textContent = `${timeLeft}s`;
      }
    }, 1000);
  }

  function endGame() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerId);
    timerId = null;

    startBtn.textContent = "Play Again";
    startBtn.disabled = false;
    startBtn.classList.add("btn-primary");
    startBtn.classList.remove("btn-secondary");

    answerInputEl.disabled = true;
    showFeedback(
      `Time! Final score: ${state.score} | Score: ${state.totalCorrect}/${state.totalAnswered}`,
      ""
    );
    saveBestScore(state.score);
  }

  function handleAnswerSubmit(event) {
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
      showFeedback("✓ Correct!", "correct");
      addHistoryEntry(currentQuestion.text, result.parsedAnswer, currentQuestion.answer, true);
    } else {
      showFeedback(`✗ ${currentQuestion.text} = ${currentQuestion.answer}`, "wrong");
      addHistoryEntry(currentQuestion.text, result.parsedAnswer, currentQuestion.answer, false);
    }

    updateScoreboard();
    answerInputEl.value = "";
    answerInputEl.focus();

    if (timeLeft > 0) {
      currentQuestion = generateQuestion();
      questionTextEl.textContent = currentQuestion.text;
    } else {
      endGame();
    }
  }

  function resetBestScore() {
    localStorage.removeItem(BEST_KEY);
    bestScoreEl.textContent = "0";
    showFeedback("Best score reset.", "");
  }

  startBtn.addEventListener("click", startGame);
  answerForm.addEventListener("submit", handleAnswerSubmit);
  resetBestBtn.addEventListener("click", resetBestScore);

  loadBestScore();
  answerInputEl.disabled = true;
  updateScoreboard();
}

if (typeof document !== "undefined") {
  initializeGame();
}
