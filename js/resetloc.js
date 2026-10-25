import { $ } from "../utils/dom.js";

const button = $("reset-location");

function easyRemover(name) {
    if (!name) return;
    localStorage.removeItem(name)
}

const widgets = [
    "calender_pos",
    "clock_pos",
    "goals_pos",
    "hackatime_pos",
    "session_pos",
    "weather_pos"
]

button.addEventListener("click", () => {
    widgets.forEach((i) => easyRemover(i));
    location.reload();
})