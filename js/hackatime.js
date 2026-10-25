import { $ } from "../utils/dom.js";
import { storage } from "./storage.js";
import { makeDraggable } from "../utils/makeDraggable.js";
import { makeResizable } from "../utils/makeResizable.js";

const hackatimeEl = $("hackatime");

const CLIENT_ID = "9XeSfhcc786niqyKWaSwdkwdQW1mhB675grHO5ecAjM"; // its not the secret so nice try :)
const REDIRECT_URI = `${window.location.origin}${window.location.pathname}`;
const HACKATIME_AUTH_URL = "https://hackatime.hackclub.com/oauth/authorize";
const HACKATIME_TOKEN_URL = "https://hackatime.hackclub.com/oauth/token";
const HACKATIME_API = "https://hackatime.hackclub.com/api/v1/authenticated";
const HACKATIME_DATA_KEY = "hackatime_saved_stats";
const HACKATIME_TOKEN_KEY = "hackatime_access_token";

const hackstatus = $("hackatime-status");
const hackconnect = $("hackatime-connect");
const hackstats = $("hackatime-stats");

function setHackatimeStatus(message) {
  hackstatus.textContent = message;
}

function base64UrlEncode(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier) {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return base64UrlEncode(new Uint8Array(digest));
}

function getDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatCodingTime(seconds) {
  const totalMinutes = Math.floor((seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m `;
}

function renderHackatimeStats(data) {
  if (!data) {
    hackstats.hidden = true;
    return;
  }

  $("hackatime-hours").textContent = formatCodingTime(
    data.hours?.total_seconds,
  );
  $("hackatime-streak").textContent = `${data.streak?.streak_days ?? 0}`;
  $("hackatime-projects").textContent =
    `${data.projects?.projects?.length ?? 0}`;

  const username = data.profile?.github_username || "Connected account";

  $("hackatime-user").textContent = `Account: ${username}`;

  const heartbeat = data.heartbeat?.heartbeat;

  $("hackatime-latest").textContent = heartbeat
    ? `Latest activity: ${heartbeat.project || "Unknown project"} (${heartbeat.language || "Unknown language"})`
    : "No recent coding activity.";

  hackstats.hidden = false;
}

async function hackatimeRequest(path, token, params = {}) {
  const url = new URL(`${HACKATIME_API}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Hackatime api error ${response.status} on ${path}`);
  }

  return response.json();
}

async function fetchHackatimeStats(token) {
  setHackatimeStatus("Fetching your coding stats...");

  const today = new Date();
  const sevenDaysAgo = new Date(today);

  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const startDate = getDateString(sevenDaysAgo);
  const endDate = getDateString(today);

  const [profile, hours, streak, heartbeat, projects] = await Promise.all([
    hackatimeRequest("me", token),
    hackatimeRequest("hours", token, {
      start_date: startDate,
      end_date: endDate,
    }),
    hackatimeRequest("streak", token),
    hackatimeRequest("heartbeats/latest", token),
    hackatimeRequest("projects", token),
  ]);

  const data = {
    profile,
    hours,
    streak,
    projects,
    heartbeat,
    fetchedAt: new Date().toISOString(),
  };

  storage.setJSON(HACKATIME_DATA_KEY, data); // cache stats

  renderHackatimeStats(data);
  setHackatimeStatus(
    `Stats updated ${new Date(data.fetchedAt).toLocaleDateString()}`,
  );

  return data;
}

async function startHackatimeOauth() {
  try {
    const state = randomVerifier();
    const verifier = randomVerifier();
    const challenge = await createCodeChallenge(verifier);

    sessionStorage.setItem("hackatime_oauth_state", state);
    sessionStorage.setItem("hackatime_oauth_verifier", verifier);

    const url = new URL(HACKATIME_AUTH_URL);

    url.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "profile read",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();

    window.location.assign(url.toString());
  } catch (error) {
    setHackatimeStatus(error.message);
  }
}

async function handleHackatimeCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const returnedState = params.get("state");
  const oauthError = params.get("error");

  if (!code && !oauthError) return;

  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + window.location.hash,
  );

  if (oauthError) {
    setHackatimeStatus(`Hackatime auth failed: ${oauthError}`);
    return;
  }

  const expectedState = sessionStorage.getItem("hackatime_oauth_state");
  const verifier = sessionStorage.getItem("hackatime_oauth_verifier");

  sessionStorage.removeItem("hackatime_oauth_state");
  sessionStorage.removeItem("hackatime_oauth_verifier");

  if (!expectedState || returnedState !== expectedState || !verifier) {
    setHackatimeStatus("Oauth state verification failed. Please connect again");
    return;
  }

  try {
    setHackatimeStatus("Complete Hackatime connection...");

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: verifier,
    });

    const response = await fetch(HACKATIME_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    const tokenDate = await response.json();

    if (!response.ok || !tokenDate.access_token) {
      throw new Error(
        tokenDate.error_description ||
          tokenDate.error ||
          "could not exchange auth code",
      );
    }

    sessionStorage.setItem(HACKATIME_TOKEN_KEY, tokenDate.access_token);

    await fetchHackatimeStats(tokenDate.access_token);
    hackconnect.hidden = true;
  } catch (error) {
    setHackatimeStatus(`Couldn't connect: ${error.message}`);
  }
}

async function refreshHackatimeStats() {
  const token = sessionStorage.getItem(HACKATIME_TOKEN_KEY);

  if (!token) {
    setHackatimeStatus("Please connect your Hackatime account to view stats.");
    return;
  }

  try {
    await fetchHackatimeStats(token);
  } catch (error) {
    setHackatimeStatus(`Couldn't refresh stats: ${error.message}`);
  }
}

hackconnect.addEventListener("click", startHackatimeOauth);

$("hackatime-refresh").addEventListener("click", refreshHackatimeStats);

$("hackatime-disconnect").addEventListener("click", () => {
  sessionStorage.removeItem(HACKATIME_TOKEN_KEY);
  localStorage.removeItem(HACKATIME_DATA_KEY);

  renderHackatimeStats(null);
  hackconnect.hidden = false;
  setHackatimeStatus("Saved stats cleared.");
});

const cachedStats = storage.getJSON(HACKATIME_DATA_KEY, null);
renderHackatimeStats(cachedStats);
if (cachedStats && sessionStorage.getItem(HACKATIME_TOKEN_KEY))
  hackconnect.hidden = true;

handleHackatimeCallback();
makeDraggable(hackatimeEl, $("hackatime-handle"), "hackatime_pos");
makeResizable(hackatimeEl, "hackatime", 280, 220);