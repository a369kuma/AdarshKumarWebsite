const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const mineLinks = document.querySelectorAll(".mine-link");
const viewLinks = document.querySelectorAll("[data-view-target]");
const tabTransition = document.querySelector("#tab-transition");
const tabTransitionVideo = document.querySelector("#tab-transition-video");
let swingTimeout = 0;
const HOLD_DURATION = 2000;
const TRANSITION_DURATION = 3000;
const TRANSITION_FADE_DURATION = 480;
const CRACK_STAGE_CLASSES = ["crack-stage-1", "crack-stage-2", "crack-stage-3", "crack-stage-4"];
const currentlyListening = document.querySelector("#currently-listening");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const year = document.querySelector("#year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

function viewFromHash(hash) {
  return hash?.replace("#", "") || "home";
}

function showView(view) {
  document.body.dataset.view = view === "home" ? "" : view;
  navLinks?.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");

  if (view === "home") {
    history.replaceState(null, "", window.location.pathname);
    return;
  }

  history.replaceState(null, "", `#${view}`);
}

function currentView() {
  return document.body.dataset.view || "home";
}

function setTransitionPlaybackRate() {
  if (!tabTransitionVideo?.duration || Number.isNaN(tabTransitionVideo.duration)) {
    tabTransitionVideo.playbackRate = 1;
    return;
  }

  tabTransitionVideo.playbackRate = tabTransitionVideo.duration / (TRANSITION_DURATION / 1000);
}

function showViewWithTransition(view) {
  if (view === currentView()) return;

  if (!tabTransition || !tabTransitionVideo) {
    showView(view);
    return;
  }

  tabTransition.classList.remove("is-fading-out");
  tabTransition.classList.add("is-active");
  tabTransition.classList.remove("is-loading");
  void tabTransition.offsetWidth;
  tabTransition.classList.add("is-loading");
  tabTransitionVideo.currentTime = 0;
  setTransitionPlaybackRate();

  const playPromise = tabTransitionVideo.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }

  window.setTimeout(() => {
    tabTransitionVideo.pause();
    tabTransitionVideo.playbackRate = 1;
    showView(view);
    tabTransition.classList.add("is-fading-out");

    window.setTimeout(() => {
      tabTransition.classList.remove("is-active", "is-fading-out", "is-loading");
    }, TRANSITION_FADE_DURATION);
  }, TRANSITION_DURATION);
}

function swingPickaxe() {
  window.clearTimeout(swingTimeout);
  document.body.classList.add("is-mining");
  swingTimeout = window.setTimeout(() => {
    document.body.classList.remove("is-mining");
  }, 120);
}

mineLinks.forEach((link) => {
  let holdStart = 0;
  let holdFrame = 0;
  let holdComplete = false;

  function resetHold() {
    window.cancelAnimationFrame(holdFrame);
    holdStart = 0;
    holdComplete = false;
    link.style.setProperty("--hold-progress", "0");
    link.classList.remove("is-holding", "is-complete", ...CRACK_STAGE_CLASSES);
  }

  function setCrackStage(progress) {
    const stage = Math.min(Math.floor(progress * CRACK_STAGE_CLASSES.length), CRACK_STAGE_CLASSES.length - 1);
    link.classList.remove(...CRACK_STAGE_CLASSES);
    link.classList.add(CRACK_STAGE_CLASSES[stage]);
  }

  function finishHold() {
    holdComplete = true;
    window.cancelAnimationFrame(holdFrame);
    link.style.setProperty("--hold-progress", "1");
    link.classList.remove("is-holding");
    link.classList.add("is-complete", "crack-stage-4");
    swingPickaxe();

    window.setTimeout(() => {
      showViewWithTransition(viewFromHash(link.hash));
      resetHold();
    }, 180);
  }

  function updateHold(now) {
    const progress = Math.min((now - holdStart) / HOLD_DURATION, 1);
    link.style.setProperty("--hold-progress", String(progress));
    setCrackStage(progress);

    if (progress >= 1) {
      finishHold();
      return;
    }

    holdFrame = window.requestAnimationFrame(updateHold);
  }

  function startHold() {
    if (holdStart || holdComplete) return;
    holdStart = performance.now();
    link.classList.add("is-holding");
    holdFrame = window.requestAnimationFrame(updateHold);
  }

  function cancelHold() {
    if (!holdStart || holdComplete) return;
    resetHold();
  }

  link.addEventListener("click", (event) => {
    event.preventDefault();
  });

  link.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    link.setPointerCapture?.(event.pointerId);
    startHold();
  });

  link.addEventListener("pointerup", cancelHold);
  link.addEventListener("pointercancel", cancelHold);
  link.addEventListener("pointerleave", cancelHold);
  link.addEventListener("contextmenu", (event) => event.preventDefault());

  link.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    startHold();
  });

  link.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    cancelHold();
  });
});

viewLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showViewWithTransition(link.dataset.viewTarget || viewFromHash(link.hash));
  });
});

const initialView = viewFromHash(window.location.hash);
if (["about", "projects", "experience"].includes(initialView)) {
  showView(initialView);
}

tabTransitionVideo?.addEventListener("loadedmetadata", setTransitionPlaybackRate);

function formatListeningText(track) {
  if (!track?.text || track.text === "Not playing anything") {
    return "Currently listening to: Nothing";
  }

  return `Currently listening to: ${track.text}`;
}

async function updateCurrentlyListening() {
  if (!currentlyListening) return;

  try {
    const response = await fetch("/api/currently-playing", { cache: "no-store" });
    if (!response.ok) return;

    const data = await response.json();
    currentlyListening.textContent = formatListeningText(data);
    currentlyListening.title = data.url ? data.text : "";
  } catch {
    currentlyListening.textContent = "Currently listening to: ____";
  }
}

updateCurrentlyListening();
window.setInterval(updateCurrentlyListening, 30000);

const canvas = document.querySelector("#hero-canvas");
const context = canvas?.getContext("2d");
let animationFrame = 0;
let clouds = [];
let stars = [];
let weatherParticles = [];
let weatherState = {
  type: "clear",
  intensity: 0,
  cloudCover: 0,
  wind: 0,
  lastLightning: 0,
  lightningFlash: 0,
};

const DAY_PHASES = {
  morning: {
    top: "#ffb36f",
    bottom: "#9fe7ff",
    cloud: "rgba(255, 246, 220, 0.9)",
    grass: "#65bd42",
    dirtA: "#9b633a",
    dirtB: "#80502f",
    dirtC: "#6d4328",
  },
  afternoon: {
    top: "#7fc8ff",
    bottom: "#bcefff",
    cloud: "rgba(255, 255, 255, 0.88)",
    grass: "#55b83f",
    dirtA: "#9a6339",
    dirtB: "#80502f",
    dirtC: "#6d4328",
  },
  evening: {
    top: "#57306f",
    bottom: "#ff9867",
    cloud: "rgba(255, 221, 185, 0.82)",
    grass: "#3f8f36",
    dirtA: "#81442f",
    dirtB: "#633420",
    dirtC: "#4f2a1b",
  },
  night: {
    top: "#07142d",
    bottom: "#17335c",
    cloud: "rgba(176, 199, 222, 0.42)",
    grass: "#2f7132",
    dirtA: "#5a3a2a",
    dirtB: "#432b21",
    dirtC: "#312019",
  },
};

function getDayPhase() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function updateHomeHeaderTint(phase) {
  document.body.dataset.dayPhase = phase;
}

function classifyWeather(current) {
  const code = Number(current.weather_code ?? 0);
  const precipitation = Number(current.precipitation ?? 0);
  const rain = Number(current.rain ?? 0) + Number(current.showers ?? 0);
  const snow = Number(current.snowfall ?? 0);
  const cloudCover = Number(current.cloud_cover ?? 0);
  const wind = Number(current.wind_speed_10m ?? 0);

  if (code >= 95 || code === 96 || code === 99) {
    return { type: "thunder", intensity: Math.max(0.8, precipitation, rain), cloudCover, wind };
  }

  if (snow > 0 || (code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { type: "snow", intensity: Math.max(0.45, snow), cloudCover, wind };
  }

  if (rain > 0 || precipitation > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { type: "rain", intensity: Math.max(0.45, rain, precipitation), cloudCover, wind };
  }

  if (code === 45 || code === 48) {
    return { type: "fog", intensity: 0.7, cloudCover, wind };
  }

  if (cloudCover >= 70 || code === 3) {
    return { type: "cloudy", intensity: cloudCover / 100, cloudCover, wind };
  }

  return { type: "clear", intensity: 0, cloudCover, wind };
}

function setWeatherState(nextState) {
  weatherState = {
    ...weatherState,
    ...nextState,
    lastLightning: 0,
    lightningFlash: 0,
  };

  if (canvas) {
    const { width, height } = canvas.getBoundingClientRect();
    resetWeatherParticles(width, height);
  }
}

async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "weather_code,precipitation,rain,showers,snowfall,cloud_cover,wind_speed_10m,wind_gusts_10m,is_day",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) return;

  const data = await response.json();
  if (data.current) {
    setWeatherState(classifyWeather(data.current));
  }
}

function initWeather() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      fetchWeather(position.coords.latitude, position.coords.longitude).catch(() => {});
    },
    () => {},
    {
      enableHighAccuracy: false,
      maximumAge: 30 * 60 * 1000,
      timeout: 7000,
    },
  );
}

function resetWeatherParticles(width, height) {
  const baseCount = weatherState.type === "snow" ? 95 : 140;
  const count = weatherState.type === "rain" || weatherState.type === "thunder"
    ? Math.min(260, Math.floor(baseCount * Math.max(1, weatherState.intensity)))
    : baseCount;

  if (!["rain", "thunder", "snow"].includes(weatherState.type)) {
    weatherParticles = [];
    return;
  }

  weatherParticles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    speed: weatherState.type === "snow" ? 0.7 + Math.random() * 1.2 : 7 + Math.random() * 6,
    drift: weatherState.type === "snow" ? -0.4 + Math.random() * 0.8 : -2 - Math.random() * 2,
    size: weatherState.type === "snow" ? 2 + Math.random() * 4 : 10 + Math.random() * 12,
  }));
}

function resizeCanvas() {
  if (!canvas || !context) return;

  const ratio = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.max(5, Math.floor(width / 230));
  clouds = Array.from({ length: count }, (_, index) => ({
    x: (width / count) * index + Math.random() * 90,
    y: 60 + Math.random() * Math.max(80, height * 0.24),
    size: 20 + Math.random() * 18,
    speed: 0.12 + Math.random() * 0.16,
  }));

  const starCount = Math.max(24, Math.floor(width / 32));
  stars = Array.from({ length: starCount }, (_, index) => ({
    x: (width / starCount) * index + Math.random() * 28,
    y: 24 + Math.random() * Math.max(90, height * 0.46),
    size: Math.random() > 0.68 ? 3 : 2,
    twinkle: Math.random() * Math.PI * 2,
  }));

  resetWeatherParticles(width, height);
}

function drawCloud(cloud, color) {
  if (!context) return;

  const s = cloud.size;
  context.fillStyle = color;
  context.fillRect(cloud.x, cloud.y + s, s * 5, s);
  context.fillRect(cloud.x + s, cloud.y, s * 3, s);
  context.fillRect(cloud.x + s * 2, cloud.y - s, s, s);
}

function drawStars(width) {
  if (!context) return;

  stars.forEach((star) => {
    const alpha = 0.65 + Math.sin(Date.now() / 700 + star.twinkle) * 0.25;
    context.fillStyle = `rgba(255, 255, 220, ${alpha})`;
    context.fillRect(star.x % width, star.y, star.size, star.size);
  });
}

function drawSun(x, y, size) {
  if (!context) return;

  context.fillStyle = "rgba(245, 216, 77, 0.18)";
  context.fillRect(x - size * 0.18, y - size * 0.18, size * 1.36, size * 1.36);
  context.fillStyle = "rgba(245, 216, 77, 0.14)";
  context.fillRect(x - size * 0.34, y - size * 0.34, size * 1.68, size * 1.68);
  context.fillStyle = "#f5d84d";
  context.fillRect(x, y, size, size);
}

function drawMoon(x, y, size) {
  if (!context) return;

  context.fillStyle = "rgba(226, 238, 224, 0.12)";
  context.fillRect(x - size * 0.22, y - size * 0.22, size * 1.44, size * 1.44);
  context.fillStyle = "#e6f0dd";
  context.fillRect(x, y, size, size);
  context.fillStyle = "#17335c";
  context.fillRect(x + size * 0.48, y + size * 0.08, size * 0.58, size * 0.84);
  context.fillStyle = "#bfcdb7";
  context.fillRect(x + size * 0.2, y + size * 0.24, size * 0.16, size * 0.16);
  context.fillRect(x + size * 0.34, y + size * 0.62, size * 0.12, size * 0.12);
}

function drawWeatherOverlay(width, height, phase) {
  if (!context) return;

  if (weatherState.type === "cloudy" || weatherState.cloudCover >= 70) {
    context.fillStyle = phase === "night" ? "rgba(10, 18, 32, 0.26)" : "rgba(80, 86, 92, 0.16)";
    context.fillRect(0, 0, width, height);
  }

  if (weatherState.type === "fog") {
    context.fillStyle = "rgba(218, 224, 220, 0.28)";
    for (let y = height * 0.18; y < height * 0.72; y += 54) {
      context.fillRect(0, y, width, 18);
      context.fillRect(28, y + 22, width * 0.88, 14);
    }
  }

  if (weatherState.type === "rain" || weatherState.type === "thunder") {
    context.strokeStyle = "rgba(174, 215, 255, 0.72)";
    context.lineWidth = 2;
    weatherParticles.forEach((drop) => {
      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x + drop.drift, drop.y + drop.size);
      context.stroke();

      drop.x += drop.drift;
      drop.y += drop.speed;

      if (drop.y > height || drop.x < -30) {
        drop.x = Math.random() * width + 30;
        drop.y = -drop.size;
      }
    });
  }

  if (weatherState.type === "snow") {
    context.fillStyle = "rgba(255, 255, 255, 0.85)";
    weatherParticles.forEach((flake) => {
      context.fillRect(flake.x, flake.y, flake.size, flake.size);
      flake.x += flake.drift;
      flake.y += flake.speed;

      if (flake.y > height || flake.x < -20 || flake.x > width + 20) {
        flake.x = Math.random() * width;
        flake.y = -flake.size;
      }
    });
  }

  if (weatherState.type === "thunder") {
    const now = performance.now();
    if (now - weatherState.lastLightning > 2600 + Math.random() * 3000) {
      weatherState.lastLightning = now;
      weatherState.lightningFlash = 8;
    }

    if (weatherState.lightningFlash > 0) {
      const boltX = width * (0.2 + Math.random() * 0.6);
      context.fillStyle = `rgba(255, 255, 240, ${weatherState.lightningFlash / 12})`;
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#fff8a8";
      context.fillRect(boltX, 0, 8, height * 0.16);
      context.fillRect(boltX - 16, height * 0.16, 24, 8);
      context.fillRect(boltX - 16, height * 0.16, 8, height * 0.16);
      context.fillRect(boltX - 34, height * 0.32, 26, 8);
      context.fillRect(boltX - 34, height * 0.32, 8, height * 0.12);
      weatherState.lightningFlash -= 1;
    }
  }
}

function drawCelestial(phase, width, height) {
  const size = Math.max(42, Math.min(78, width * 0.06));

  if (phase === "morning") {
    drawSun(width * 0.15, height * 0.18, size);
    return;
  }

  if (phase === "afternoon") {
    drawSun(width * 0.73, height * 0.1, size);
    return;
  }

  if (phase === "evening") {
    drawSun(width * 0.84, height * 0.28, size);
    return;
  }

  drawMoon(width * 0.78, height * 0.12, size * 0.86);
}

function draw() {
  if (!canvas || !context) return;

  const { width, height } = canvas.getBoundingClientRect();
  const phase = getDayPhase();
  const palette = DAY_PHASES[phase];
  updateHomeHeaderTint(phase);
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.top);
  gradient.addColorStop(1, palette.bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  if (phase === "night") {
    drawStars(width);
  }

  drawCelestial(phase, width, height);

  clouds.forEach((cloud) => {
    drawCloud(cloud, palette.cloud);
    cloud.x += cloud.speed;

    if (cloud.x > width + cloud.size * 6) {
      cloud.x = -cloud.size * 6;
      cloud.y = 60 + Math.random() * Math.max(80, height * 0.24);
    }
  });

  drawWeatherOverlay(width, height, phase);

  animationFrame = window.requestAnimationFrame(draw);
}

if (canvas && context) {
  resizeCanvas();
  initWeather();
  draw();
  window.addEventListener("resize", resizeCanvas);
}

window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(animationFrame);
});
