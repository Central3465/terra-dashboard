import { $ } from "../utils/dom.js";
import { makeDraggable } from "../utils/makeDraggable.js";
import { makeResizable } from "../utils/makeResizable.js";

const clockEl = $("clock");
const goalsEl = $("goals");
const sessionsEl = $("sessions");

makeDraggable(clockEl, $("clock-handle"), "clock_pos");
makeDraggable(goalsEl, $("goals-handle"), "goals_pos");
makeDraggable(sessionsEl, $("sessions-handle"), "session_pos");

makeResizable(clockEl, "clock", 280, 220);
makeResizable(goalsEl, "goals", 260, 200);
makeResizable(sessionsEl, "sessions", 280, 220);
