import { storage } from "../js/storage.js";

export function makeDraggable(panel, handle, storageKey) {
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
