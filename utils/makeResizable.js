import { storage } from "../js/storage.js";

export function makeResizable(
  element,
  storageKey,
  minWidth = 240,
  minHeight = 180,
) {
  if (!element) return;

  const sizeKey = `widget_size_${storageKey}`;

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "resize-handle";
  handle.innerHTML = '<span aria-hidden="true">◢</span>';
  handle.title = "Drag to resize me";
  handle.setAttribute("aria-label", "Resize me");
  handle.setAttribute(
    "aria-keyshortcuts",
    "ArrowLeft ArrowRight ArrowUp ArrowDown",
  );

  element.appendChild(handle);

  const savedSize = storage.getJSON(sizeKey, null);

  function applySize(width, height) {
    const maxWidth = Math.max(minWidth, window.innerWidth - 24);
    const maxHeight = Math.max(minHeight, window.innerHeight - 24);
    const newWidth = Math.min(maxWidth, Math.max(minWidth, width));
    const newHeight = Math.min(maxHeight, Math.max(minHeight, height));

    element.style.width = `${newWidth}px`;
    element.style.height = `${newHeight}px`;
  }

  if (
    savedSize &&
    Number.isFinite(savedSize.width) &&
    Number.isFinite(savedSize.height)
  ) {
    applySize(savedSize.width, savedSize.height);
  }

  let resizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  handle.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    resizing = true;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = element.getBoundingClientRect().width;
    startHeight = element.getBoundingClientRect().height;

    handle.classList.add("resizing");
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!resizing) return;

    const width = startWidth + event.clientX - startX;
    const height = startHeight + event.clientY - startY;

    applySize(width, height);
  });

  function finishResize() {
    if (!resizing) return;

    resizing = false;
    handle.classList.remove("resizing");

    const rect = element.getBoundingClientRect();

    storage.setJSON(sizeKey, {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }

  handle.addEventListener("pointerup", finishResize);
  handle.addEventListener("pointercancel", finishResize);
  handle.addEventListener("lostpointercapture", finishResize);

  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 40 : 10;
    const rect = element.getBoundingClientRect();

    let width = rect.width;
    let height = rect.height;

    switch (event.key) {
      case "ArrowRight":
        width += step;
        break;
      case "ArrowLeft":
        width -= step;
        break;
      case "ArrowDown":
        width += step;
        break;
      case "ArrowUp":
        height -= step;
        break;
      default:
        return;
    }

    event.preventDefault();
    applySize(width, height);

    const updated = element.getBoundingClientRect();

    storage.setJSON(sizeKey, {
      width: Math.round(updated.width),
      height: Math.round(updated.height),
    });
  });

  window.addEventListener("resize", () => {
    if (!element.style.width || !element.style.height) return;

    const rect = element.getBoundingClientRect();
    applySize(rect.width, rect.height);
  });
}
