import { $ } from "../utils/dom.js";
import { makeDraggable } from "../utils/makeDraggable.js";
import { makeResizable } from "../utils/makeResizable.js";

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
makeResizable(weatherEL, $("weather-handle"), 240, 160 );
