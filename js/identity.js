import { $ } from "../utils/dom.js";
import { storage } from "./storage.js";

const askBox = $("ask_name");
const showName = $("show-name");
const clockEl = $("clock");
const goalsEl = $("goals");
const calenderEl = $("calender")
const sessionsEl = $("sessions");
const hackatimeEl = $("hackatime");

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
  hackatimeEl.classList.remove("hidden");
  hackatimeEl.classList.add("pop-in")
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
