import { $ } from "../utils/dom.js";
import { storage } from "./storage.js";
import { makeDraggable } from "../utils/makeDraggable.js";
import { makeResizable } from "../utils/makeResizable.js";

const calenderEl = $("calender");

const eventsEl = $("events");
const eventForm = $("event-form");
const eventTitle = $("event-title");
const eventDate = $("event-date");
const eventTime = $("event-time");
const eventDescription = $("event-description");
const eventStatus = $("event-status");

let calendarEvents = storage.getJSON("calendar_events", []);

calendarEvents = Array.isArray(calendarEvents)
  ? calendarEvents
      .filter(
        (event) =>
          event &&
          typeof event.id === "string" &&
          typeof event.title === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
          /^\d{2}:\d{2}$/.test(event.time) &&
          (event.description == null || typeof event.description === "string"),
      )
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        description: event.description || "",
      }))
  : [];

function saveCalendarEvents() {
  storage.setJSON("calendar_events", calendarEvents);
}

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

eventDate.value = localDateString();

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
  calendarMonthEl.textContent = displayedMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

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
        year: "numeric",
      })}${hasEvents ? ", has events" : ""}`,
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
    "Events for " +
    new Date(
      ...selectedDate
        .split("-")
        .map(Number)
        .map((v, i) => (i === 1 ? v - 1 : v)),
    ).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
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
    minute: "2-digit",
  });
}

function renderCalendarEvents() {
  eventsEl.replaceChildren();

  const sortedEvents = calendarEvents
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (sortedEvents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No events scheduled on this date - add one above!";
    eventsEl.append(empty);
    return;
  }

  const now = new Date();

  sortedEvents.forEach((event) => {
    const card = document.createElement("article");
    card.className = "calendar-event";

    const eventDateTime = new Date(...event.date.split("-").map(Number));

    const [year, month, day] = event.date.split("-").map(Number);
    const [hours, minutes] = event.time.split(":").map(Number);
    eventDateTime.setFullYear(year, month - 1, day);
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
      const description = document.createElement("p");
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
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "goal-remove";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete event: ${event.title}`);

    deleteButton.addEventListener("click", () => {
      calendarEvents = calendarEvents.filter((item) => item.id !== event.id);
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
    eventStatus.textContent = "Please enter a title, date and time.";
    return;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const checkedDate = new Date(year, month - 1, day, hours, minutes);

  if (
    checkedDate.getFullYear() !== year ||
    checkedDate.getMonth() !== month - 1 ||
    checkedDate.getDate() !== day
  ) {
    eventStatus.textContent = "please enter valid date";
    return;
  }

  const id = globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  calendarEvents.push({
    id,
    title,
    date,
    time,
    description,
  });

  saveCalendarEvents();
  selectedDate = date;
  displayedMonth = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    1,
  );
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
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes) + 60,
  );

  const end =
    [
      endDate.getFullYear(),
      String(endDate.getMonth() + 1).padStart(2, "0"),
      String(endDate.getDate()).padStart(2, "0"),
    ].join("") +
    "T" +
    String(endDate.getHours()).padStart(2, "0") +
    String(endDate.getMinutes()).padStart(2, "0") +
    "00";

  const uid = `${event.id}@terra-dashboard.local`;
  const stamp = new Date()
    .toISOString()
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

  const blob = new Blob([lines.join("\r\n") + "\r\n"], {
    type: "text/calendar;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.date}-${
    event.title
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "event"
  }.ics`;

  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

renderCalendarEvents();

makeDraggable(calenderEl, $("calender-handle"), "calender_pos");
makeResizable(calenderEl, $("calender-handle"), 320, 300);
