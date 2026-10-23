import "./identity.js";
import "./pomodoro.js";
import "./goals.js";
import "./weather.js";
import "./calendar.js";
import "./hackatime.js";
import "./widgets.js";

// service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./serviceworker.js")
      .then(() => {
        console.log("service worker registered");
      })
      .catch((error) => {
        console.log("failed:", error);
      });
  });
}
