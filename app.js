const preview = document.getElementById("preview");
const previewSvg = document.getElementById("previewSvg");
const generateBtn = document.getElementById("generateBtn");
const exportBtn = document.getElementById("exportBtn");
const ratioButtons = document.querySelectorAll(".ratio-btn");
const formatSelect = document.getElementById("format");
const variationSelect = document.getElementById("variation");
const specRatio = document.getElementById("specRatio");
const specSize = document.getElementById("specSize");
const specFormat = document.getElementById("specFormat");
const specStyle = document.getElementById("specStyle");

let currentSvg = "";
let svgWidth = 0;
let svgHeight = 0;
let selectedRatio = "16:9";
let seed = Math.random() * 10000;

const RESOLUTION = 1024;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SYMBOLS = "@#$%&*!?";

const VARIATIONS = {
  blocks:  { chars: "█▓▒░",       label: "Blocks" },
  dots:    { chars: ".:-=+*#@",   label: "Dots" },
  lines:   { chars: "|/-\\+×",    label: "Lines" },
  waves:   { chars: "~^v><()",    label: "Waves" },
  binary:  { chars: "01",         label: "Binary" },
  letters: { chars: LETTERS,      label: "Letters" },
  numbers: { chars: NUMBERS,      label: "Numbers" },
  symbols: { chars: SYMBOLS,      label: "Symbols" },
  mixed:   { chars: null,         label: "Mixed" },
  braille: { chars: "⣀⣤⣶⣿⡀⡄⡆⡇⠁⠃⠇", label: "Braille" },
  minimal: { chars: "·∙•○",       label: "Minimal" },
  cross:   { chars: "+×x.",       label: "Cross" },
  slash:   { chars: "/\\|_",      label: "Slash" },
};

document.querySelectorAll('input[type="range"]').forEach((slider) => {
  const valueLabel = document.querySelector(`.value[data-for="${slider.id}"]`);
  const updateLabel = () => { valueLabel.textContent = (slider.value / 100).toFixed(2); };

  slider.addEventListener("input", () => {
    updateLabel();
    render(false);
  });
  updateLabel();
});

ratioButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    ratioButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedRatio = btn.dataset.ratio;
    applyAspectRatio(selectedRatio);
    updateSpecs();
    render(false);
  });
});

function applyAspectRatio(ratio) {
  const [w, h] = ratio.split(":").map(Number);
  preview.style.aspectRatio = `${w} / ${h}`;
  preview.style.setProperty("--aspect-w", w);
  preview.style.setProperty("--aspect-h", h);
}

function updateSpecs() {
  const style = VARIATIONS[variationSelect.value];
  specRatio.textContent = selectedRatio;
  specSize.textContent = `${RESOLUTION} px`;
  specFormat.textContent = formatSelect.value.toUpperCase();
  specStyle.textContent = style ? style.label : variationSelect.value;
}

formatSelect.addEventListener("change", updateSpecs);
variationSelect.addEventListener("change", () => {
  updateSpecs();
  render(false);
});

updateSpecs();
applyAspectRatio(selectedRatio);

generateBtn.addEventListener("click", () => render(true));
document.addEventListener("keydown", (e) => {
  if (e.key === "g" || e.key === "G") render(true);
});

function noise2D(x, y, s) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
  return n - Math.floor(n);
}

function layeredNoise(x, y, complexity, s) {
  let val = 0;
  let amp = 1;
  let total = 0;
  const layers = 1 + Math.floor(complexity / 25);

  for (let i = 0; i < layers; i++) {
    const freq = Math.pow(2, i);
    val += noise2D(x * freq, y * freq, s + i * 91) * amp;
    total += amp;
    amp *= 0.5;
  }
  return val / total;
}

function pickMixedChar(col, row, s) {
  const typeNoise = noise2D(col + 100, row + 100, s + 500);
  let pool;
  if (typeNoise < 0.34) pool = LETTERS;
  else if (typeNoise < 0.67) pool = NUMBERS;
  else pool = SYMBOLS;

  const idx = Math.floor(noise2D(col + 200, row + 200, s + 700) * pool.length);
  return pool[idx];
}

function pickChar(variation, chars, col, row, n, contrast, s) {
  if (variation === "mixed") {
    return pickMixedChar(col, row, s);
  }

  const charIndex = Math.min(
    chars.length - 1,
    Math.floor(n * chars.length * (1 + contrast))
  );
  return chars[charIndex];
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(newSeed) {
  if (newSeed) seed = Math.random() * 10000;

  const density = Number(document.getElementById("density").value) / 100;
  const scale = Number(document.getElementById("scale").value);
  const complexity = Number(document.getElementById("complexity").value);
  const contrast = Number(document.getElementById("contrast").value) / 100;
  const variation = variationSelect.value;
  const chars = VARIATIONS[variation].chars;

  const [rw, rh] = selectedRatio.split(":").map(Number);
  svgWidth = RESOLUTION;
  svgHeight = Math.round(RESOLUTION * (rh / rw));

  const fontSize = Math.max(8, Math.round(10 + scale / 4));
  const charW = fontSize * 0.62;
  const charH = fontSize * 1.1;
  const cols = Math.ceil(svgWidth / charW);
  const rows = Math.ceil(svgHeight / charH);
  const accentThreshold = 0.55 + contrast * 0.3;

  const textElements = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const n = layeredNoise(col, row, complexity, seed);

      if (n > 1 - density) continue;

      const char = pickChar(variation, chars, col, row, n, contrast, seed);
      if (!char || char === " ") continue;

      const useAccent = n < accentThreshold && noise2D(col + 50, row + 50, seed + 999) > 0.4;
      const fill = useAccent ? "#FF3C00" : `rgba(26, 26, 26, ${0.25 + n * 0.75})`;
      const x = col * charW;
      const y = row * charH + fontSize;

      textElements.push(
        `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${fill}" font-size="${fontSize}" font-family="'SF Mono', Menlo, Consolas, monospace">${escapeXml(char)}</text>`
      );
    }
  }

  currentSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${textElements.join("\n  ")}
</svg>`;

  previewSvg.innerHTML = currentSvg;
  updateSpecs();
}

exportBtn.addEventListener("click", () => {
  if (!currentSvg) return;

  const format = formatSelect.value;

  if (format === "svg") {
    downloadBlob(currentSvg, "microgenerator.svg", "image/svg+xml");
    return;
  }

  const mimeTypes = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
  const blob = new Blob([currentSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = svgWidth;
    canvas.height = svgHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const link = document.createElement("a");
    link.download = `microgenerator.${format}`;
    link.href = canvas.toDataURL(mimeTypes[format] || "image/png");
    link.click();
    URL.revokeObjectURL(url);
  };

  img.src = url;
});

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

render(true);
