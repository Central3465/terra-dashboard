(() => {
  "use strict";

  /* ---------- safe storage ---------- */
  const storage = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : v; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    },
    getJSON(key, fallback) {
      try { return JSON.parse(this.get(key) ?? "null") ?? fallback; }
      catch { return fallback; }
    },
    setJSON(key, value) { this.set(key, JSON.stringify(value)); },
  };

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- identity ---------- */
  const askBox  = $("ask_name");
  const showName = $("show-name");
  const clockEl = $("clock");
  const goalsEl = $("goals");

  function greet(name) {
    showName.textContent = `Welcome, ${name}!`;
    showName.classList.add("visible");
    askBox.classList.add("hidden");
    goalsEl.classList.remove("hidden");
    clockEl.classList.remove("hidden");
    clockEl.classList.add("pop-in");
    goalsEl.classList.add("pop-in");
  }

  const savedName = storage.get("saved_name");
  if (savedName) greet(savedName);

  function submitName() {
    const input = $("name");
    const value = input.value.trim();
    if (!value) { input.focus(); return; }
    storage.set("saved_name", value);
    greet(value);
  }
  $("submit-name").addEventListener("click", submitName);
  $("name").addEventListener("keydown", (e) => { if (e.key === "Enter") submitName(); });

  /* ---------- timer ---------- */
  const timeInput = $("the-actual-time");
  const startBtn  = $("start");
  const resetBtn  = $("reset");

  const START = 24 * 60;         // 24 minutes
  const MAX   = 99 * 60 + 59;    // 99:59

  let remaining = START;         // seconds
  let endTime   = null;          // ms timestamp when running
  let tickId    = null;

  function parseTime(str) {
    const m = String(str).trim().match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    const mins = Number(m[1]);
    const secs = Number(m[2]);
    if (secs > 59 || mins > 99) return null;
    return mins * 60 + secs;
  }

  function clamp(value) {
    return Math.max(0, Math.min(MAX, value));
  }

  function formatTime(totalSecs) {
    return `${pad(Math.floor(totalSecs / 60))}:${pad(totalSecs % 60)}`;
  }

  function render(force = false) {
    if (!force && document.activeElement === timeInput) return;
    timeInput.value = formatTime(remaining);
  }

  function commitInput() {
    const parsed = parseTime(timeInput.value);
    if (parsed !== null) remaining = clamp(parsed);
    render(true);
  }

  function stopTimer() {
    if (tickId !== null) { clearInterval(tickId); tickId = null; }
    if (endTime !== null) {
      remaining = clamp(Math.round((endTime - Date.now()) / 1000));
      endTime = null;
    }
    startBtn.textContent = "Start";
    render(true);
  }

  function tick() {
    const left = Math.round((endTime - Date.now()) / 1000);
    remaining = clamp(left);
    if (remaining <= 0) {
      stopTimer();
      timeInput.classList.add("done");
      return;
    }
    render();
  }

  function startTimer() {
    if (remaining <= 0) return;
    timeInput.classList.remove("done");
    endTime = Date.now() + remaining * 1000;
    tickId = setInterval(tick, 250); // frequent enough to stay accurate
    startBtn.textContent = "Pause";
  }

  timeInput.addEventListener("blur", commitInput);
  timeInput.addEventListener("focus", (e) => e.target.select());
  timeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { timeInput.blur(); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const running = tickId !== null;
      if (running) return; // don't allow manual adjust mid-run
      commitInput();
      remaining = clamp(remaining + (e.key === "ArrowUp" ? 60 : -60));
      render(true);
    }
  });
  timeInput.addEventListener("wheel", (e) => {
    if (tickId !== null) return;
    e.preventDefault();
    commitInput();
    const step = e.shiftKey ? 1 : 60;
    remaining = clamp(remaining + (e.deltaY < 0 ? step : -step));
    render(true);
  }, { passive: false });

  startBtn.addEventListener("click", () => {
    if (tickId !== null) { stopTimer(); return; }
    commitInput();
    if (remaining <= 0) return;
    startTimer();
  });
  resetBtn.addEventListener("click", () => {
    stopTimer();
    remaining = START;
    timeInput.classList.remove("done");
    render(true);
  });

  render(true);

  /* ---------- drag utility (shared, accessible) ---------- */
  function makeDraggable(panel, handle, storageKey) {
    let pos = storage.getJSON(storageKey, { x: 0, y: 0 });
    let drag = null;

    const apply = () => {
      panel.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    };
    apply();

    handle.addEventListener("pointerdown", (e) => {
      drag = { sx: e.clientX, sy: e.clientY, bx: pos.x, by: pos.y };
      handle.setPointerCapture(e.pointerId);
      panel.classList.add("dragging");
      handle.focus();
    });
    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      pos = { x: drag.bx + (e.clientX - drag.sx), y: drag.by + (e.clientY - drag.sy) };
      apply();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      panel.classList.remove("dragging");
      storage.setJSON(storageKey, pos);
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);

    // keyboard nudge
    handle.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 20 : 5;
      const map = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      pos = { x: pos.x + d[0], y: pos.y + d[1] };
      apply();
      storage.setJSON(storageKey, pos);
    });
  }

  makeDraggable(clockEl, $("clock-handle"), "clock_pos");
  makeDraggable(goalsEl, $("goals-handle"), "goals_pos");

  /* ---------- goals ---------- */
  const goalList  = $("goal-list");
  const goalEmpty = $("goal-empty");
  const goalInput = $("goal-input");

  let goals = storage.getJSON("goals", []).filter(g => typeof g === "object" && g !== null && typeof g.text === "string");
  // migrate old plain-string goals
  goals = goals.map(g => ({ text: g.text, done: !!g.done }));

  function saveGoals() { storage.setJSON("goals", goals); }

  function renderGoals() {
    goalList.replaceChildren();
    goalEmpty.classList.toggle("hidden", goals.length > 0);
    goals.forEach((goal, i) => {
      const row = document.createElement("div");
      row.className = "goal" + (goal.done ? " done" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = goal.done;
      checkbox.setAttribute("aria-label", `Mark "${goal.text}" complete`);
      checkbox.addEventListener("change", () => {
        goals[i].done = checkbox.checked;
        saveGoals();
        renderGoals();
      });

      const label = document.createElement("span");
      label.className = "goal-text";
      label.textContent = goal.text; // textContent = XSS-safe

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "goal-remove";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", `Delete goal: ${goal.text}`);
      remove.addEventListener("click", () => {
        goals.splice(i, 1);
        saveGoals();
        renderGoals();
      });

      row.append(checkbox, label, remove);
      goalList.append(row);
    });
  }

  function addGoal() {
    const text = goalInput.value.trim();
    if (!text) { goalInput.focus(); return; }
    goals.push({ text, done: false });
    saveGoals();
    goalInput.value = "";
    renderGoals();
  }

  $("add-goal").addEventListener("click", addGoal);
  goalInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addGoal(); });

  renderGoals();
})();