const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const mineLinks = document.querySelectorAll(".mine-link");
let swingTimeout = 0;

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

function swingPickaxe() {
  window.clearTimeout(swingTimeout);
  document.body.classList.add("is-mining");
  swingTimeout = window.setTimeout(() => {
    document.body.classList.remove("is-mining");
  }, 120);
}

function mineBlock(link) {
  const requiredHits = Number(link.dataset.hits || 3);
  const currentHits = Number(link.dataset.currentHits || 0) + 1;
  const progress = Math.min(currentHits / requiredHits, 1);

  link.dataset.currentHits = String(currentHits);
  link.style.setProperty("--mine-progress", String(progress));
  link.classList.remove("is-hit");
  void link.offsetWidth;
  link.classList.add("is-hit");
  swingPickaxe();

  if (currentHits < requiredHits) {
    return;
  }

  link.classList.add("is-breaking");

  window.setTimeout(() => {
    navLinks?.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
    window.location.hash = link.hash;

    window.setTimeout(() => {
      link.dataset.currentHits = "0";
      link.style.setProperty("--mine-progress", "0");
      link.classList.remove("is-hit", "is-breaking");
    }, 420);
  }, 240);
}

mineLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    mineBlock(link);
  });

  link.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    mineBlock(link);
  });
});

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
