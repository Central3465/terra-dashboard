import { $ } from "../utils/dom.js";
import { storage } from "./storage.js";

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
  const completed = goals.filter((goal) => goal.done).length;

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
