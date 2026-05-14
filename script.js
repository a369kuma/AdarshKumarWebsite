const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

const year = document.querySelector("#year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const canvas = document.querySelector("#hero-canvas");
const context = canvas?.getContext("2d");
let animationFrame = 0;
let particles = [];

function resizeCanvas() {
  if (!canvas || !context) return;

  const ratio = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.max(18, Math.floor(width / 38));
  particles = Array.from({ length: count }, (_, index) => ({
    x: (width / count) * index + Math.random() * 28,
    y: Math.random() * height,
    radius: 1.5 + Math.random() * 3,
    speed: 0.15 + Math.random() * 0.35,
    drift: -0.18 + Math.random() * 0.36,
    hue: index % 3,
  }));
}

function draw() {
  if (!canvas || !context) return;

  const { width, height } = canvas.getBoundingClientRect();
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(13, 118, 110, 0.08)");
  gradient.addColorStop(0.45, "rgba(214, 162, 63, 0.12)");
  gradient.addColorStop(1, "rgba(179, 83, 47, 0.08)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  particles.forEach((particle) => {
    const palette = [
      "rgba(13, 118, 110, 0.28)",
      "rgba(179, 83, 47, 0.23)",
      "rgba(67, 134, 161, 0.24)",
    ];

    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fillStyle = palette[particle.hue];
    context.fill();

    particle.y -= particle.speed;
    particle.x += particle.drift;

    if (particle.y < -12) {
      particle.y = height + 12;
      particle.x = Math.random() * width;
    }
  });

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
