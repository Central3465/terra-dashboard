import { $, pad } from "../utils/dom.js";
import { storage } from "./storage.js";

const timeInput = $("the-actual-time");
const startBtn = $("start");
const resetBtn = $("reset");
const timerProgress = $("timer-progress");
const timerCaption = document.querySelector(".timer-caption");
const FOCUS_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const MAX = 99 * 60 + 59;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 54;

let mode = "focus";
let paused = false
let remaining = FOCUS_DURATION;
let cycleDuration = FOCUS_DURATION;
let endTime= null;
let tickId = null;

if (timerProgress) {
  timerProgress.style.strokeDasharray = TIMER_CIRCUMFERENCE;
}

let sessions = storage.getJSON("puma_sessions", []);
if (!Array.isArray(sessions)) sessions = [];

sessions = sessions.filter((session) => session && typeof session.id === "string" &&
  ["focus", "break"].includes(session.type) && Number.isFinite(session.duration) &&
  typeof session.completedAt === "string"
);

function saveSessions() {
  storage.setJSON("puma_sessions", sessions);
}

function renderSessions() {
  const list = $("session-list");
  const focusCount = $("focus-count");
  const focusMinutes = $("focus-minutes");

  if (!list || !focusCount || !focusMinutes) return;

  list.replaceChildren();

  const focusSessions = sessions.filter((session) => session.type === "focus");

  focusCount.textContent = focusSessions.length;

  focusMinutes.textContent = Math.round(focusSessions.reduce((total, session) => total + session.duration, 0) / 60);

  if (sessions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No completed sessions yet. Time to focus";
    list.append(empty)
    return;
  }
  // order session by most recent
  [...sessions].reverse().slice(0, 30).forEach((session) => {
    const row = document.createElement("article");
    row.className = "session-entry";
    const title = document.createElement("strong");
    title.textContent = session.type === "focus" ? "Focus session" : "Break";
    const details = document.createElement("p");
    details.textContent = `${Math.round(session.duration / 60)} minutes - ` + new Date(session.completedAt).toLocaleDateString();
    row.append(title, details);
    list.append(row);
  });
}

function parseTime(str) {
  const match = String(str).trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;

  const mins = Number(match[1]);
  const secs = Number(match[2]);

  if (secs > 59 || mins > 99) return null;
  return mins * 60 + secs;
}

function clamp(value) {
  return Math.max(0, Math.min(MAX, value));
}

function formatTime(totalSecs) {
  return `${pad(Math.floor(totalSecs / 60))}:${pad(totalSecs % 60)}`;
}

function updateTimerRing() {
  if (!timerProgress) return;
  const progress = cycleDuration > 0 ? Math.max(0, Math.min(1, remaining / cycleDuration)) : 0;
  timerProgress.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - progress);
}

function render(force = false) {
  if (force || document.activeElement !== timeInput) {
    timeInput.value = formatTime(remaining);
  }

  updateTimerRing();

  if (timerCaption) {
    timerCaption.textContent = mode === "focus" ? "FOCUS SESSION" : "SHORT BREAK";
  }

  startBtn.textContent = tickId !== null ? "Pause" : "Start";
}

function commitInput() {
  const parsed = parseTime(timeInput.value);

  if (parsed !== null) {
    const value = clamp(parsed);

    if (!paused || value !== remaining) {
      remaining = value;
      cycleDuration = value;
      paused = false;
    }
  }

  render(true)
}

function stopTimer() {
  if (tickId !== null) {
    clearInterval(tickId);
    tickId = null;
  }

  if (endTime !== null) {
    remaining = clamp(Math.ceil((endTime - Date.now()) / 1000));
    endTime = null;
  }

  render(true);
}

function startTimer() {
  paused = false;
  if (remaining <= 0) return;

  timeInput.classList.remove("done");

  // cycleDuration = remaining; don't reset progress in history when paused
  endTime = Date.now() + remaining * 1000;
  tickId = setInterval(tick, 250);

  render(true);
}

function completeSession() {
  if (tickId !== null) {
    clearInterval(tickId);
    tickId = null;
  }

  endTime = null;
  remaining = 0;

  sessions.push({
    id: globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: mode, duration: cycleDuration, completedAt: new Date().toISOString(),
  });

  saveSessions();
  renderSessions();

  timeInput.classList.add("done");

  if (mode === "focus") {
    mode = "break";
    remaining = BREAK_DURATION;
  } else {
    mode = "focus";
    remaining = FOCUS_DURATION;
  }

  cycleDuration = remaining;
  render(true);

  const nextPhase = mode === "break" ? "Time for a 5-minute break!" : "Break complete! Ready for another session?";
  
  if ("Notification" in window && Notification.permission === "granted") { new Notification("Terra Pomodoro", { body: nextPhase })};
}

function tick() {
  remaining = clamp(Math.ceil((endTime - Date.now()) / 1000));
  if (remaining <= 0) {
    completeSession();
    return;
  }

  render();
}

timeInput.addEventListener("blur", commitInput);
timeInput.addEventListener("focus", (e) => e.target.select());

timeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    timeInput.blur();
    return;
  }

  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    if (tickId != null) return;

    commitInput();
    remaining = clamp(remaining + (e.key === "ArrowUp" ? 60 : -60));
    cycleDuration = remaining;
    render(true);
  }
});

timeInput.addEventListener("wheel", (e) => {
  if (tickId !== null) return;

  e.preventDefault();
  commitInput();

  const step = e.shiftKey ? 1 : 60;
  remaining = clamp(remaining + (e.deltaY < 0 ? step : -step));
  cycleDuration = remaining;
  render(true);
}, { passive: false});

startBtn.addEventListener("click", () => {
  if (tickId !== null) {
    stopTimer();
    paused = remaining > 0;
    return;
  }

  commitInput();

  if (remaining <= 0) return;

  startTimer();
});

resetBtn.addEventListener("click", () => {
  stopTimer();
  paused = false;
  mode = "focus";
  remaining = FOCUS_DURATION;
  cycleDuration = FOCUS_DURATION;
  timeInput.classList.remove("done");
  render(true);
});

$("clear-sessions").addEventListener("click", () => {
  if (!confirm("Clear all completed session history?")) return;

  sessions = [];
  saveSessions();
  renderSessions();
});

renderSessions();
render(true);
