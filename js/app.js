(() => {
  "use strict";

  // service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register("./serviceworker.js")
            .then(registration => {
                console.log('service worker registered')
            })
            .catch(error => {
                console.log('failed:', error)
            })
    })
 }

  /* ---------- safe storage ---------- */
  const storage = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    getJSON(key, fallback) {
      try {
        return JSON.parse(this.get(key) ?? "null") ?? fallback;
      } catch {
        return fallback;
      }
    },
    setJSON(key, value) {
      this.set(key, JSON.stringify(value));
    },
  };

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- identity ---------- */
  const askBox = $("ask_name");
  const showName = $("show-name");
  const clockEl = $("clock");
  const goalsEl = $("goals");
  const calenderEl = $("calender")
  const sessionsEl = $("sessions");

  function greet(name) {
    showName.textContent = `Welcome, ${name}!`;
    showName.classList.add("visible");
    askBox.classList.add("hidden");
    goalsEl.classList.remove("hidden");
    clockEl.classList.remove("hidden");
    calenderEl.classList.remove("hidden")
    $("weather").classList.remove("hidden");
    clockEl.classList.add("pop-in");
    goalsEl.classList.add("pop-in");
    calenderEl.classList.add("pop-in")
    sessionsEl.classList.remove("hidden");
    sessionsEl.classList.add("pop-in")
  }

  const savedName = storage.get("saved_name");
  if (savedName) greet(savedName);

  function submitName() {
    const input = $("name");
    const value = input.value.trim();
    if (!value) {
      input.focus();
      return;
    }
    storage.set("saved_name", value);
    greet(value);
  }
  $("submit-name").addEventListener("click", submitName);
  $("name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitName();
  });

  // timer -------------------------------------- pomodoro
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
      pos = {
        x: drag.bx + (e.clientX - drag.sx),
        y: drag.by + (e.clientY - drag.sy),
      };
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
      const map = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
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
  makeDraggable(sessionsEl, $("sessions-handle"), "session_pos");

  /* ---------- goals ---------- */
  const goalList = $("goal-list");
  const goalEmpty = $("goal-empty");
  const goalInput = $("goal-input");

  let goals = storage
    .getJSON("goals", [])
    .filter(
      (g) => typeof g === "object" && g !== null && typeof g.text === "string",
    );
  // migrate old plain-string goals
  goals = goals.map((g) => ({ text: g.text, done: !!g.done }));

  function saveGoals() {
    storage.setJSON("goals", goals);
  }

  function updateGoalProgress() {
    const progressFill = $("progress-fill");

    if (!progressFill) return;

    const total = goals.length;
    const completed = goals.filter(goal => goal.done).length;

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    progressFill.style.width = `${percentage}%`;
    progressFill.title = `${completed} of ${total} goals completed`;
  }

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
        updateGoalProgress();
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
        updateGoalProgress();
        renderGoals();
      });

      row.append(checkbox, label, remove);
      goalList.append(row);
    });
  }

  function addGoal() {
    const text = goalInput.value.trim();
    if (!text) {
      goalInput.focus();
      return;
    }
    goals.push({ text, done: false });
    saveGoals();
    goalInput.value = "";
    renderGoals();
  }

  $("add-goal").addEventListener("click", addGoal);
  goalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addGoal();
  });

  renderGoals();

  // WEATHER MY ASS ---------------------------------------------------

  const weatherEL = $("weather");
  const weatherContent = $("weather-content");

  const WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    56: "Freezing drizzle", 57: "Dense freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
  }

  function renderWeather(w) {
    const code = w.weather_code;
    const desc = WEATHER_CODES[code] ?? `Code ${code}`;
    weatherContent.replaceChildren();

    const temp = document.createElement("div");
    temp.className = "weather-temp";
    temp.textContent = `${Math.round(w.temperature_2m)}ºC`

    const feels = document.createElement("div");
    feels.className = "weather-detail";
    feels.textContent = `Feels like ${Math.round(w.apparent_temperature)}ºC`

    const condition = document.createElement("div");
    condition.className = "weather-detail";
    condition.textContent = desc

    const extra = document.createElement("div");
    extra.className = "weather-detail"
    extra.textContent = `Humidity ${w.relativehumidity_2m}% -- Wind ${w.wind_speed_10m} km/h`
    
    weatherContent.append(temp, condition, feels, extra)
  }

  function renderWeatherError(msg) {
    weatherContent.replaceChildren();
    const p = document.createElement("p")
    p.className = "empty"
    p.textContent = msg
    weatherContent.append(p)
  }

  function fetchWeather() {
    if (!navigator.geolocation) {
      renderWeatherError("Geolocation not supported")
      return
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url = new URL("https://api.open-meteo.com/v1/forecast")
          url.search = new URLSearchParams({
            latitude: coords.latitude,
            longitude: coords.longitude,
            current: 
              "temperature_2m,relativehumidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            timezone: "auto",
          });

          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json()
          renderWeather(data.current);
        } catch (err) {
          console.error("Weather fetch failed:", err)
          renderWeatherError("Couldn't load weather.")
        }
      },
      (err) => {
        console.error("Geolocation failed:", err);
        renderWeatherError("Location permission denied.");
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000},
    );
  }

  fetchWeather()
  setInterval(fetchWeather, 15 * 60 * 1000);
  makeDraggable(weatherEL, $("weather-handle"), "weather_pos");

  // calender ----------------------------------------------------------
  const eventsEl = $("events");
  const eventForm = $("event-form");
  const eventTitle = $("event-title");
  const eventDate = $("event-date");
  const eventTime = $("event-time");
  const eventDescription = $("event-description");
  const eventStatus = $("event-status");

  let calendarEvents = storage.getJSON("calendar_events", []);

  calendarEvents = Array.isArray(calendarEvents)
    ? calendarEvents.filter((event) =>
      event &&
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
    /^\d{2}:\d{2}$/.test(event.time) &&
    (event.description == null || typeof event.description === "string")
    ).map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      description: event.description || "",
    }))
    : [];

  function saveCalendarEvents() {
    storage.setJSON("calendar_events", calendarEvents)
  }

  function localDateString(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  eventDate.value = localDateString()

  const calendarMonthEl = $("calendar-month");
  const calendarGrid = $("calendar-grid");
  const selectedDateEl = $("calendar-selected-date");

  const today = localDateString();
  let selectedDate = today;

  let displayedMonth = new Date();
  displayedMonth.setDate(1);

  function renderInteractiveCalendar() {
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    calendarMonthEl.textContent = displayedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric"});

    calendarGrid.replaceChildren();

    const firstDay = new Date(year, month, 1).getDay();
    const offset = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < 42; i++) {
      const dayNumber = i - offset + 1;
      const date = new Date(year, month, dayNumber);
      const dateString = localDateString(date);
      const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
      
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.textContent = date.getDate();

      if (!inMonth) button.classList.add("outside-month");
      if (dateString === today) button.classList.add("today");
      if (dateString === selectedDate) button.classList.add("selected");

      const hasEvents = calendarEvents.some((event) => event.date === dateString);

      if (hasEvents) button.classList.add("has-events");

      button.setAttribute(
        "aria-label",
        `${date.toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric"
        })}${hasEvents ? ", has events": ""}`
      );

      button.setAttribute("aria-pressed", String(dateString === selectedDate));

      button.addEventListener("click", () => {
        selectedDate = dateString;

        displayedMonth = new Date(date.getFullYear(), date.getMonth(), 1);

        eventDate.value = selectedDate;
        renderInteractiveCalendar();
        renderCalendarEvents();
      });
      calendarGrid.append(button);
    }

    selectedDateEl.textContent = 
      "Events for " + new Date(
        ...selectedDate.split("-").map(Number).map((v, i) => i === 1 ? v -1 : v)
        ).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric"}
      );
  }

  $("calendar-prev").addEventListener("click", () => {
    displayedMonth.setMonth(displayedMonth.getMonth() - 1);
    renderInteractiveCalendar();
  });

  $("calendar-next").addEventListener("click", () => {
    displayedMonth.setMonth(displayedMonth.getMonth() + 1);
    renderInteractiveCalendar();
  });

  function formatEventDate(dateString, timeString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);

    return date.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderCalendarEvents() {
    eventsEl.replaceChildren();

    const sortedEvents = calendarEvents.filter(event => event.date === selectedDate).sort((a,b) => a.time.localeCompare(b.time));

    if (sortedEvents.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No events scheduled on this date - add one above!"
      eventsEl.append(empty)
      return;
    }

    const now = new Date();

    sortedEvents.forEach((event) => {
      const card = document.createElement("article")
      card.className = "calendar-event";

      const eventDateTime = new Date(
        ...event.date.split("-").map(Number) 
      );

      const [year, month, day] = event.date.split("-").map(Number);
      const [hours, minutes] = event.time.split(":").map(Number);
      eventDateTime.setFullYear(year, month -1, day);
      eventDateTime.setHours(hours, minutes, 0, 0);

      if (eventDateTime < now) {
        card.classList.add("past-event");
      }

      const heading = document.createElement("h3");
      heading.textContent = event.title;

      const date = document.createElement("p");
      date.className = "calendar-event-date";
      date.textContent = formatEventDate(event.date, event.time);

      card.append(heading, date);

      if (event.description) {
        const description = document.createElement("p")
        description.className = "calendar-event-description";
        description.textContent = event.description;
        card.append(description);
      }

      const actions = document.createElement("div");
      actions.className = "calendar-event-actions";

      const exportButton = document.createElement("button");
      exportButton.type = "button";
      exportButton.textContent = "Export .ics";
      exportButton.addEventListener("click", () => {
        exportCalendarEvent(event);
      })

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "goal-remove";
      deleteButton.textContent = "Delete";
      deleteButton.setAttribute(
        "aria-label",
        `Delete event: ${event.title}`
      );

      deleteButton.addEventListener("click", () => {
        calendarEvents = calendarEvents.filter(
          (item) => item.id !== event.id
        );
        saveCalendarEvents();
        renderCalendarEvents();
        eventStatus.textContent = "Event deleted.";
      });

      actions.append(exportButton, deleteButton);
      card.append(actions);
      eventsEl.append(card);
    });
  }

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = eventTitle.value.trim();
    const date = eventDate.value;
    const time = eventTime.value;
    const description = eventDescription.value.trim();

    if (!title || !date || !time) {
      eventStatus.textContent = "Please enter a title, date and time."
      return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const checkedDate = new Date(year, month - 1, day, hours, minutes);

    if (
      checkedDate.getFullYear() !== year ||
      checkedDate.getMonth() !== month -1 ||
      checkedDate.getDate() !== day
    ) {
      eventStatus.textContent = "please enter valid date";
      return;
    }

    const id = globalThis.crypto?.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    calendarEvents.push({
      id, title, date, time, description
    });

    saveCalendarEvents();
    selectedDate = date;
    displayedMonth = new Date(Number(date.slice(0, 4)), Number(date.slice(5,7)) - 1, 1);
    renderInteractiveCalendar();
    renderCalendarEvents();
    eventForm.reset();
    eventDate.value = localDateString();
    eventTitle.focus();
    eventStatus.textContent = "Event added successfully!";
  });

  function escapeICSText(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function exportCalendarEvent(event) {
    const [year, month, day] = event.date.split("-");
    const [hours, minutes] = event.time.split(":");

    const start = `${year}${month}${day}T${hours}${minutes}00`;

    const endDate = new Date(
      Number(year),
      Number(month) -1,
      Number(day),
      Number(hours), 
      Number(minutes) + 60
    );

    const end = [
      endDate.getFullYear(),
      String(endDate.getMonth() + 1).padStart(2, "0"),
      String(endDate.getDate()).padStart(2, "0"),
    ].join("") +
      "T" +
      String(endDate.getHours()).padStart(2, "0") +
      String(endDate.getMinutes()).padStart(2, "0") +
      "00";

    const uid = `${event.id}@terra-dashboard.local`;
    const stamp = new Date().toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Terra Dashboard//Calendar//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeICSText(event.title)}`,
      `DESCRIPTION:${escapeICSText(event.description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const blob = new Blob(
      [lines.join("\r\n") + "\r\n"],
      { type: "text/calendar;charset=utf-8"}
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.date}-${event.title
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "event"}.ics`;

    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  renderCalendarEvents();

  makeDraggable(calenderEl, $("calender-handle"), "calender_pos");

  function updateGreeting() {
    const name = storage.get("saved_name") || "friend";

    const greetings = [
      "Lovely summer day, isn't it?",
      `What's up, ${name}?`,
      `OMG, it's ${name}!`,
      `Hey, ${name}!`,
    ];

    const greetingEl = document.getElementById("greeting");

    if (!greetingEl) return;

    const randomIndex = Math.floor(Math.random() * greetings.length);
    greetingEl.textContent = greetings[randomIndex];
  }

  updateGreeting();
})();
