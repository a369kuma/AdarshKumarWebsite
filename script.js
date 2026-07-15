const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const mineLinks = document.querySelectorAll(".mine-link");
const viewLinks = document.querySelectorAll("[data-view-target]");
const tabTransition = document.querySelector("#tab-transition");
const tabTransitionVideo = document.querySelector("#tab-transition-video");
let swingTimeout = 0;
const HOLD_DURATION = 2000;
const TRANSITION_DURATION = 3000;
const CRACK_STAGE_CLASSES = ["crack-stage-1", "crack-stage-2", "crack-stage-3", "crack-stage-4"];

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

function showViewWithTransition(view) {
  if (view === currentView()) return;

  if (!tabTransition || !tabTransitionVideo) {
    showView(view);
    return;
  }

  tabTransition.classList.add("is-active");
  tabTransitionVideo.currentTime = 0;

  const playPromise = tabTransitionVideo.play();
  if (playPromise) {
    playPromise.catch(() => {});
  }

  window.setTimeout(() => {
    tabTransitionVideo.pause();
    showView(view);
    tabTransition.classList.remove("is-active");
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

const canvas = document.querySelector("#hero-canvas");
const context = canvas?.getContext("2d");
let animationFrame = 0;
let clouds = [];

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
}

function drawBlock(x, y, size, color) {
  if (!context) return;

  context.fillStyle = color;
  context.fillRect(x, y, size, size);
}

function drawCloud(cloud) {
  if (!context) return;

  const s = cloud.size;
  context.fillStyle = "rgba(255, 255, 255, 0.88)";
  context.fillRect(cloud.x, cloud.y + s, s * 5, s);
  context.fillRect(cloud.x + s, cloud.y, s * 3, s);
  context.fillRect(cloud.x + s * 2, cloud.y - s, s, s);
}

function draw() {
  if (!canvas || !context) return;

  const { width, height } = canvas.getBoundingClientRect();
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#7fc8ff");
  gradient.addColorStop(1, "#bcefff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  clouds.forEach((cloud) => {
    drawCloud(cloud);
    cloud.x += cloud.speed;

    if (cloud.x > width + cloud.size * 6) {
      cloud.x = -cloud.size * 6;
      cloud.y = 60 + Math.random() * Math.max(80, height * 0.24);
    }
  });

  const block = 34;
  const groundY = Math.max(height - 110, height * 0.78);
  for (let x = -block; x < width + block; x += block) {
    drawBlock(x, groundY, block, "#55b83f");
    drawBlock(x, groundY + block, block, x % (block * 2) === 0 ? "#9a6339" : "#80502f");
    drawBlock(x, groundY + block * 2, block, x % (block * 3) === 0 ? "#6d4328" : "#8a5634");
  }

  animationFrame = window.requestAnimationFrame(draw);
}

if (canvas && context) {
  resizeCanvas();
  draw();
  window.addEventListener("resize", resizeCanvas);
}

window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(animationFrame);
});
