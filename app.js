const preview = document.getElementById("preview");
const previewSvg = document.getElementById("previewSvg");
const generateBtn = document.getElementById("generateBtn");
const exportBtn = document.getElementById("exportBtn");
const ratioButtons = document.querySelectorAll(".ratio-btn");
const formatSelect = document.getElementById("format");
const variationSelect = document.getElementById("variation");
const patternSelect = document.getElementById("pattern");
const specRatio = document.getElementById("specRatio");
const specSize = document.getElementById("specSize");
const specFormat = document.getElementById("specFormat");
const specStyle = document.getElementById("specStyle");

let currentSvg = "";
let svgWidth = 0;
let svgHeight = 0;
let selectedRatio = "16:9";
let seed = Math.random() * 10000;
let compositionIndex = 0;

const RESOLUTION = 1024;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SYMBOLS = "@#$%&*!?";

const VARIATIONS = {
  blocks:  { chars: "\u2588\u2593\u2592\u2591",       label: "Blocks" },
  dots:    { chars: ".:-=+*#@",   label: "Dots" },
  lines:   { chars: "|/-\\+\u00D7",    label: "Lines" },
  waves:   { chars: "~^v><()",    label: "Waves" },
  binary:  { chars: "01",         label: "Binary" },
  letters: { chars: LETTERS,      label: "Letters" },
  numbers: { chars: NUMBERS,      label: "Numbers" },
  symbols: { chars: SYMBOLS,      label: "Symbols" },
  mixed:   { chars: null,         label: "Mixed" },
  braille: { chars: "\u28C0\u28E0\u28E4\u28F6\u28FF\u2840\u2844\u2846\u2847\u2801\u2803\u2807", label: "Braille" },
  minimal: { chars: "\u00B7\u2219\u2022\u25CB",       label: "Minimal" },
  cross:   { chars: "+\u00D7x.",       label: "Cross" },
  slash:   { chars: "/\\|_",      label: "Slash" },
};

const DITHER_TYPES = {
  ordered4x4: {
    matrix: [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ],
  },
};
const DITHER_TYPE = "ordered4x4";

const MIN_FIELD_COLS = 48;
const MAX_FIELD_COLS = 128;

function getBaseFieldDimensions(rw, rh, density) {
  const fieldCols = Math.round(lerp(MIN_FIELD_COLS, MAX_FIELD_COLS, density));
  const fieldRows = Math.max(24, Math.round(fieldCols * rh / rw));
  return { cols: fieldCols, rows: fieldRows };
}

document.querySelectorAll('input[type="range"]').forEach((slider) => {
  const valueLabel = document.querySelector('.value[data-for="' + slider.id + '"]');
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
  preview.style.aspectRatio = w + ' / ' + h;
  preview.style.setProperty("--aspect-w", w);
  preview.style.setProperty("--aspect-h", h);
}

function updateSpecs() {
  const style = VARIATIONS[variationSelect.value];
  const pattern = patternSelect.value;
  specRatio.textContent = selectedRatio;
  specSize.textContent = RESOLUTION + ' px';
  specFormat.textContent = formatSelect.value.toUpperCase();
  specStyle.textContent = pattern.charAt(0).toUpperCase() + pattern.slice(1);
}

formatSelect.addEventListener("change", updateSpecs);
variationSelect.addEventListener("change", () => {
  updateSpecs();
  render(false);
});
patternSelect.addEventListener("change", () => {
  updateSpecs();
  render(false);
});

updateSpecs();
applyAspectRatio(selectedRatio);

generateBtn.addEventListener("click", () => render(true));
document.addEventListener("keydown", (e) => {
  if (e.key === "g" || e.key === "G") render(true);
});

// --- Seeded Random System ---

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const n00 = noise2D(x0, y0, seed);
  const n10 = noise2D(x1, y0, seed);
  const n01 = noise2D(x0, y1, seed);
  const n11 = noise2D(x1, y1, seed);
  return lerp(lerp(n00, n10, tx), lerp(n01, n11, tx), ty);
}

function fbmNoise(x, y, octaves, seed) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < octaves; octave++) {
    value += valueNoise2D(x * frequency, y * frequency, seed + octave * 47) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / total;
}

function cellularNoise(x, y, seed) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  let nearest = 8;
  let second = 8;

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      const latticeX = cellX + offsetX;
      const latticeY = cellY + offsetY;
      const pointX = latticeX + 0.2 + noise2D(latticeX, latticeY, seed) * 0.6;
      const pointY = latticeY + 0.2 + noise2D(latticeX, latticeY, seed + 19) * 0.6;
      const distance = Math.hypot(x - pointX, y - pointY);

      if (distance < nearest) {
        second = nearest;
        nearest = distance;
      } else if (distance < second) {
        second = distance;
      }
    }
  }

  return {
    region: clamp(1 - nearest * 1.15, 0, 1),
    edge: clamp(1 - (second - nearest) * 2.4, 0, 1),
  };
}

function hueFromSeed(seed) {
  return noise2D(100, 200, seed + 5000);
}

function satFromSeed(seed) {
  return 0.45 + noise2D(300, 400, seed + 6000) * 0.4;
}

// --- Composition Algorithms ---

// Each algorithm produces a Composition object:
// {
//   elements: [{ type, x, y, width, height, radius, density, hue, saturation, rotation, strength, ... }],
//   negativeSpace: [{ x, y, radius }],
//   field: 2D array of values (for algorithms that compute their own field)
// }

// Helper: circles overlap check
function circlesOverlap(c1, c2, allowOverlap = 0.15) {
  const dx = c1.cx - c2.cx;
  const dy = c1.cy - c2.cy;
  const dist = Math.hypot(dx, dy);
  const minDist = (c1.radius + c2.radius) * (1 - allowOverlap);
  return dist < minDist;
}

function ellipseOverlap(e1, e2, allowOverlap = 0.15) {
  const dx = e1.cx - e2.cx;
  const dy = e1.cy - e2.cy;
  const dist = Math.hypot(dx, dy);
  const avgRadius = (e1.radius + e2.radius) || ((e1.width + e1.height + e2.width + e2.height) / 4);
  const minDist = avgRadius * (1 - allowOverlap);
  return dist < minDist;
}

function composeOrganicBlob({ complexity, scale, seed }) {
  const elementCount = 3 + Math.floor(complexity * 6);
  const allowOverlap = 0.1 + scale * 0.2;
  const elements = [];
  const negativeSpace = [];

  const baseHue = hueFromSeed(seed + 100);
  const baseSat = satFromSeed(seed + 200);

  for (let i = 0; i < elementCount; i++) {
    const cx = noise2D(i + 10, 100, seed + i * 37);
    const cy = noise2D(i + 20, 200, seed + i * 53);
    const radius = 0.08 + noise2D(i + 30, 300, seed + i * 71) * 0.12 * (0.5 + scale * 0.5);
    const rotation = noise2D(i + 40, 400, seed + i * 89) * Math.PI * 2;

    let placed = false;
    let attempts = 0;
    let finalCx = cx, finalCy = cy;

    while (attempts < 20 && !placed) {
      let conflict = false;
      for (const existing of elements) {
        if (ellipseOverlap(
          { cx: finalCx, cy: finalCy, radius, width: radius * 2, height: radius * 2 },
          existing, allowOverlap
        )) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        placed = true;
      } else {
        finalCx = cx + (noise2D(i + 50, 500, seed + i * 101) - 0.5) * 0.1;
        finalCy = cy + (noise2D(i + 60, 600, seed + i * 109) - 0.5) * 0.1;
        attempts++;
      }
    }

    if (placed) {
      const hue = baseHue + (noise2D(i + 70, 700, seed + i * 131) - 0.5) * 0.3;
      const sat = baseSat + (noise2D(i + 80, 800, seed + i * 137) - 0.5) * 0.3;
      const stretch = 0.7 + noise2D(i + 90, 900, seed + i * 149) * 0.6;

      elements.push({
        type: "blob",
        cx: finalCx,
        cy: finalCy,
        width: radius * stretch * 2,
        height: radius / stretch * 2,
        radius,
        density: 0.5 + noise2D(i + 100, 1000, seed + i * 157) * 0.5,
        hue: (hue % 1 + 1) % 1,
        saturation: clamp(sat, 0.2, 0.9),
        rotation,
        strength: 0.7 + noise2D(i + 110, 1100, seed + i * 167) * 0.3,
      });
    }
  }

  // Generate a few negative space regions
  const negCount = 1 + Math.floor(complexity * 3);
  for (let i = 0; i < negCount; i++) {
    negativeSpace.push({
      cx: noise2D(i + 200, 200, seed + i * 173 + 999),
      cy: noise2D(i + 210, 400, seed + i * 181 + 999),
      radius: 0.05 + noise2D(i + 220, 600, seed + i * 191 + 999) * 0.1,
    });
  }

  return { elements, negativeSpace };
}

function composePacking({ complexity, scale, seed }) {
  const elements = [];
  const negativeSpace = [];

  const baseHue = hueFromSeed(seed + 101);
  const baseSat = satFromSeed(seed + 201);

  const gridSize = 16 + Math.floor(complexity * 24);
  const placed = [];

  for (let attempt = 0; attempt < gridSize * gridSize * 3; attempt++) {
    const cx = noise2D(attempt + 10, 100, seed + attempt * 31 + 100);
    const cy = noise2D(attempt + 20, 200, seed + attempt * 41 + 100);
    const baseRadius = 0.02 + noise2D(attempt + 30, 300, seed + attempt * 51 + 100) * 0.06;
    const radius = baseRadius * (0.6 + scale * 0.8);

    let conflict = false;
    for (const existing of placed) {
      const dx = cx - existing.cx;
      const dy = cy - existing.cy;
      const dist = Math.hypot(dx, dy);
      const minDist = (radius + existing.radius) * 0.98;
      if (dist < minDist) {
        conflict = true;
        break;
      }
    }

    if (!conflict) {
      const hue = baseHue + (noise2D(attempt + 40, 400, seed + attempt * 61 + 100) - 0.5) * 0.4;
      const sat = baseSat + (noise2D(attempt + 50, 500, seed + attempt * 71 + 100) - 0.5) * 0.2;

      elements.push({
        type: "circle",
        cx, cy, radius,
        density: 0.6 + noise2D(attempt + 60, 600, seed + attempt * 83 + 100) * 0.4,
        hue: (hue % 1 + 1) % 1,
        saturation: clamp(sat, 0.3, 0.85),
        rotation: noise2D(attempt + 70, 700, seed + attempt * 97 + 100) * Math.PI * 2,
        strength: 0.5 + noise2D(attempt + 80, 800, seed + attempt * 101 + 100) * 0.5,
      });
      placed.push({ cx, cy, radius });
    }
  }

  // Generate negative space
  const negCount = 1 + Math.floor(complexity * 2);
  for (let i = 0; i < negCount; i++) {
    negativeSpace.push({
      cx: noise2D(i + 300, 300, seed + i * 109 + 999),
      cy: noise2D(i + 310, 500, seed + i * 113 + 999),
      radius: 0.08 + noise2D(i + 320, 700, seed + i * 127 + 999) * 0.12,
    });
  }

  return { elements, negativeSpace };
}

function composeVoronoi({ complexity, scale, seed }) {
  const elements = [];
  const negativeSpace = [];

  // Number of seed points - scales with complexity and scale
  const pointCount = Math.max(6, 8 + Math.floor(complexity * 24) + Math.floor(scale * 20));
  const points = [];

  for (let i = 0; i < pointCount; i++) {
    points.push({
      x: noise2D(i + 10, 100, seed + i * 37 + 200),
      y: noise2D(i + 20, 200, seed + i * 53 + 200),
      weight: 0.5 + noise2D(i + 30, 300, seed + i * 71 + 200) * 0.5,
    });
  }

  // Grid for Voronoi computation - resolution affects cell detail
  const gridCols = 32 + Math.floor(complexity * 24);
  const gridRows = Math.max(18, Math.floor(gridCols * 0.75));

  // Compute Voronoi assignment for each grid cell
  // Each cell belongs to the nearest point (with weight scaling)
  const cellToPoint = [];
  for (let r = 0; r < gridRows; r++) {
    cellToPoint.push(new Array(gridCols).fill(-1));
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const u = c / (gridCols - 1);
      const v = r / (gridRows - 1);
      let bestDist = Infinity;
      let bestIdx = -1;

      for (let i = 0; i < pointCount; i++) {
        const p = points[i];
        const dx = u - p.x;
        const dy = v - p.y;
        // Weighted distance - higher weight = smaller effective distance
        const dist = (dx * dx + dy * dy) / (p.weight + 0.1);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      cellToPoint[r][c] = bestIdx;
    }
  }

  // Find boundaries between different cells
  const boundaryGrid = [];
  for (let r = 0; r < gridRows; r++) {
    boundaryGrid.push(new Array(gridCols).fill(0));
  }

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const pid = cellToPoint[r][c];
      let isBoundary = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
            if (cellToPoint[nr][nc] !== pid) {
              isBoundary = true;
              break;
            }
          }
        }
        if (isBoundary) break;
      }
      boundaryGrid[r][c] = isBoundary ? 1 : 0;
    }
  }

  // Find connected regions for each point (actual Voronoi cells)
  const visited = [];
  for (let r = 0; r < gridRows; r++) {
    visited.push(new Array(gridCols).fill(false));
  }

  const baseHue = hueFromSeed(seed + 102);
  let regionId = 0;

  for (let i = 0; i < pointCount; i++) {
    // Find all cells belonging to this point
    const cellCoords = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (cellToPoint[r][c] === i) {
          cellCoords.push({ r, c });
        }
      }
    }

    if (cellCoords.length < 3) continue;

    // Compute centroid and bounds
    const cx = cellCoords.reduce((sum, cell) => sum + cell.c, 0) / cellCoords.length / gridCols;
    const cy = cellCoords.reduce((sum, cell) => sum + cell.r, 0) / cellCoords.length / gridRows;
    
    let minR = gridRows, maxR = 0, minC = gridCols, maxC = 0;
    for (const cell of cellCoords) {
      minR = Math.min(minR, cell.r);
      maxR = Math.max(maxR, cell.r);
      minC = Math.min(minC, cell.c);
      maxC = Math.max(maxC, cell.c);
    }
    const width = (maxC - minC + 1) / gridCols;
    const height = (maxR - minR + 1) / gridRows;

    // Count boundary cells for edge detail
    let boundaryCount = 0;
    for (const cell of cellCoords) {
      if (boundaryGrid[cell.r][cell.c]) boundaryCount++;
    }
    const edgeFactor = boundaryCount / cellCoords.length;

    const hue = baseHue + (noise2D(i + 40, 400, seed + i * 89 + 200) - 0.5) * 0.5;

    elements.push({
      type: "cell",
      x: cx - width / 2,
      y: cy - height / 2,
      width: width * 0.95,
      height: height * 0.95,
      density: 0.5 + noise2D(i + 50, 500, seed + i * 97 + 200) * 0.4,
      hue: (baseHue + noise2D(i + 40, 400, seed + i * 89 + 200) * 0.5) % 1,
      saturation: 0.4 + noise2D(i + 50, 500, seed + i * 97 + 200) * 0.5,
      rotation: noise2D(i + 60, 600, seed + i * 101 + 200) * Math.PI * 2,
      strength: 0.6 + (1 - edgeFactor) * 0.4,
    });
    regionId++;
  }

  // Negative space: suppress some cells
  const suppressCount = Math.floor(pointCount * (0.1 + complexity * 0.15));
  for (let i = 0; i < suppressCount; i++) {
    const idx = Math.floor(noise2D(i + 700, 700, seed + i * 103 + 200) * pointCount);
    const point = points[idx];
    if (point) {
      negativeSpace.push({
        cx: point.x,
        cy: point.y,
        radius: 0.03 + noise2D(i + 800, 800, seed + i * 107 + 200) * 0.08,
      });
    }
  }

  // Return boundary grid for edge signal in field builder
  return { elements, negativeSpace, grid: { cols: gridCols, rows: gridRows }, boundaries: boundaryGrid };
}

function composeFlowField({ complexity, scale, seed }) {
  const elements = [];
  const negativeSpace = [];

  // Generate vector field using noise
  const fieldCols = 16 + Math.floor(complexity * 24);
  const fieldRows = Math.max(8, Math.floor(fieldCols * 0.75));
  const fieldScale = 2 + complexity * 2;

  // Build a vector field
  const vectors = [];
  for (let row = 0; row < fieldRows; row++) {
    for (let col = 0; col < fieldCols; col++) {
      const angle = fbmNoise(col / fieldCols * fieldScale, row / fieldRows * fieldScale, 2, seed + 300) * Math.PI * 4;
      vectors.push({ col, row, angle });
    }
  }

  // Generate particles that follow the field
  const particleCount = 10 + Math.floor(complexity * 30);
  const baseHue = hueFromSeed(seed + 103);
  const baseSat = satFromSeed(seed + 203);

  for (let i = 0; i < particleCount; i++) {
    let x = noise2D(i + 10, 100, seed + i * 37 + 300);
    let y = noise2D(i + 20, 200, seed + i * 53 + 300);
    const pathLength = 5 + Math.floor(complexity * 15);
    const segments = [];

    for (let step = 0; step < pathLength; step++) {
      segments.push({ x, y });

      // Sample field
      const fCol = clamp(Math.floor(x * (fieldCols - 1)), 0, fieldCols - 1);
      const fRow = clamp(Math.floor(y * (fieldRows - 1)), 0, fieldRows - 1);
      const idx = fRow * fieldCols + fCol;

      // Bilinear interpolation
      const fColF = x * (fieldCols - 1);
      const fRowF = y * (fieldRows - 1);
      const c0 = Math.floor(fColF);
      const c1 = Math.min(fieldCols - 1, c0 + 1);
      const r0 = Math.floor(fRowF);
      const r1 = Math.min(fieldRows - 1, r0 + 1);
      const tx = fColF - c0;
      const ty = fRowF - r0;

      const a00 = vectors[r0 * fieldCols + c0].angle;
      const a01 = vectors[r0 * fieldCols + c1].angle;
      const a10 = vectors[r1 * fieldCols + c0].angle;
      const a11 = vectors[r1 * fieldCols + c1].angle;

      let angle = lerp(
        lerp(a00, a01, tx),
        lerp(a10, a11, tx),
        ty
      );

      const stepSize = 0.005 + scale * 0.003;
      x += Math.cos(angle) * stepSize;
      y += Math.sin(angle) * stepSize;

      if (x < 0 || x > 1 || y < 0 || y > 1) break;
    }

    if (segments.length > 2) {
      const hue = baseHue + (noise2D(i + 40, 400, seed + i * 89 + 300) - 0.5) * 0.3;
      const sat = baseSat + (noise2D(i + 50, 500, seed + i * 97 + 300) - 0.5) * 0.2;

      elements.push({
        type: "path",
        segments,
        density: 0.5 + noise2D(i + 60, 600, seed + i * 101 + 300) * 0.5,
        hue: (hue % 1 + 1) % 1,
        saturation: clamp(sat, 0.3, 0.8),
        rotation: 0,
        strength: 0.4 + noise2D(i + 70, 700, seed + i * 109 + 300) * 0.4,
      });
    }
  }

  // Negative space: areas where no particles traveled
  const negCount = 1 + Math.floor(complexity * 2);
  for (let i = 0; i < negCount; i++) {
    negativeSpace.push({
      cx: noise2D(i + 800, 800, seed + i * 113 + 300),
      cy: noise2D(i + 900, 900, seed + i * 127 + 300),
      radius: 0.06 + noise2D(i + 1000, 1000, seed + i * 131 + 300) * 0.1,
    });
  }

  return { elements, negativeSpace, grid: { cols: fieldCols, rows: fieldRows } };
}

function composeReactionDiffusion({ complexity, scale, seed }) {
  const elements = [];
  const negativeSpace = [];

  // Gray-Scott reaction-diffusion model (lightweight)
  // Produces cellular/organic patterns: spots, stripes, labyrinths
  // Based on: U + 2V -> 3V (reaction), U' = -UV^2 + F(1-U), V' = UV^2 - (F+k)V
  // Diffusion: U diffuses faster than V

  // Grid size - larger for more detail
  const gridCols = 48 + Math.floor(complexity * 40);
  const gridRows = Math.max(36, Math.floor(gridCols * 0.75));

  // Parameters for spot patterns (F=0.024-0.03, k=0.053-0.057) - tighter ranges for stability
  const F = 0.024 + noise2D(seed + 100, 200, 400) * 0.006; // 0.024-0.03
  const k = 0.053 + noise2D(seed + 300, 400, 500) * 0.004; // 0.053-0.057
  const Du = 0.16 + noise2D(seed + 500, 600, 700) * 0.04;  // U diffusion
  const Dv = 0.08 + noise2D(seed + 700, 800, 900) * 0.02;  // V diffusion

  // Initialize U and V grids
  const U = [];
  const V = [];
  for (let r = 0; r < gridRows; r++) {
    U.push(new Array(gridCols).fill(1.0)); // U starts at 1
    V.push(new Array(gridCols).fill(0.0)); // V starts at 0
  }

  // Seed with random perturbations
  const seedCount = 8 + Math.floor(complexity * 12);
  for (let i = 0; i < seedCount; i++) {
    const cx = Math.floor(noise2D(i + 10, 100, seed + i * 37 + 400) * (gridCols - 4)) + 2;
    const cy = Math.floor(noise2D(i + 20, 200, seed + i * 53 + 400) * (gridRows - 4)) + 2;
    const radius = 2 + Math.floor(complexity * 3);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < gridCols && ny >= 0 && ny < gridRows) {
          if (dx * dx + dy * dy <= radius * radius) {
            U[ny][nx] = 0.5 + noise2D(i + 100, 200, seed + i * 71) * 0.3;
            V[ny][nx] = 0.25 + noise2D(i + 300, 400, seed + i * 89) * 0.15;
          }
        }
      }
    }
  }

  // Run reaction-diffusion simulation
  // Scale controls simulation steps (time)
  const simSteps = 400 + Math.floor(complexity * 600) + Math.floor(scale * 400);
  const dt = 1.0;

  // Laplacian kernel weights
  const lapWeights = [
    [0.05, 0.2, 0.05],
    [0.2, -1.0, 0.2],
    [0.05, 0.2, 0.05]
  ];

  for (let step = 0; step < simSteps; step++) {
    const newU = [];
    const newV = [];

    for (let r = 0; r < gridRows; r++) {
      newU.push(new Array(gridCols));
      newV.push(new Array(gridCols));
    }

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        // Laplacian of U (with periodic boundary conditions)
        let lapU = 0, lapV = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = (r + dr + gridRows) % gridRows;
            const nc = (c + dc + gridCols) % gridCols;
            const w = lapWeights[dr + 1][dc + 1];
            lapU += U[nr][nc] * w;
            lapV += V[nr][nc] * w;
          }
        }

        const u = U[r][c];
        const v = V[r][c];
        const uvv = u * v * v;

        // Gray-Scott equations
        newU[r][c] = u + (Du * lapU - uvv + F * (1 - u)) * dt;
        newV[r][c] = v + (Dv * lapV + uvv - (F + k) * v) * dt;

        // Clamp
        if (newU[r][c] < 0) newU[r][c] = 0;
        if (newU[r][c] > 1) newU[r][c] = 1;
        if (newV[r][c] < 0) newV[r][c] = 0;
        if (newV[r][c] > 1) newV[r][c] = 1;
      }
    }

    // Swap
    for (let r = 0; r < gridRows; r++) {
      U[r] = newU[r];
      V[r] = newV[r];
    }
  }

  // Extract patterns from V field (inhibitor forms patterns)
  // Use multiple thresholds to capture different pattern features
  const visited = [];
  for (let r = 0; r < gridRows; r++) {
    visited.push(new Array(gridCols).fill(false));
  }

  // Multi-threshold extraction matching actual V range (~0.1-0.26)
  const thresholds = [
    0.22 + noise2D(seed + 1000, 2000, 3000) * 0.05,  // high V spots
    0.16 + noise2D(seed + 2000, 3000, 4000) * 0.05,  // intermediate
    0.10 + noise2D(seed + 3000, 4000, 5000) * 0.05   // background boundaries
  ];

  const baseHue = hueFromSeed(seed + 104);
  let regionId = 0;

  for (let ti = 0; ti < thresholds.length; ti++) {
    const threshold = thresholds[ti];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (V[r][c] > threshold && !visited[r][c]) {
        // Flood fill to find connected region
        const regionCells = [];
        const stack = [{ r, c }];
        visited[r][c] = true;

        while (stack.length > 0) {
          const cell = stack.pop();
          regionCells.push(cell);

          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = cell.r + dr;
              const nc = cell.c + dc;
              if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
                if (V[nr][nc] > threshold && !visited[nr][nc]) {
                  visited[nr][nc] = true;
                  stack.push({ r: nr, c: nc });
                }
              }
            }
          }
        }

        // Minimum size filter
        if (regionCells.length > 4) {
          const cx = regionCells.reduce((sum, cell) => sum + cell.c, 0) / regionCells.length / gridCols;
          const cy = regionCells.reduce((sum, cell) => sum + cell.r, 0) / regionCells.length / gridRows;
          const size = Math.sqrt(regionCells.length / (gridCols * gridRows));
          const hue = baseHue + (noise2D(regionId + 50, 500, seed + regionId * 61 + 400) - 0.5) * 0.4;

          elements.push({
            type: "cell",
            x: cx - size / 2,
            y: cy - size / 2,
            width: size,
            height: size * (0.7 + noise2D(regionId + 60, 600, seed + regionId * 71 + 400) * 0.5),
            density: 0.5 + noise2D(regionId + 70, 700, seed + regionId * 89 + 400) * 0.5,
            hue: (hue % 1 + 1) % 1,
            saturation: 0.45 + noise2D(regionId + 80, 800, seed + regionId * 97 + 400) * 0.4,
            rotation: noise2D(regionId + 90, 900, seed + regionId * 101 + 400) * Math.PI * 2,
            strength: 0.5 + noise2D(regionId + 100, 1000, seed + regionId * 109 + 400) * 0.5,
          });
regionId++;
        }
      }
    }
    }
  }

  // Also extract U patterns (activator) for additional structure
  // Reset visited for U field
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      visited[r][c] = false;
    }
  }

  const uThreshold = 0.5 + noise2D(seed + 2000, 3000, 4000) * 0.2;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (U[r][c] > uThreshold && !visited[r][c]) {
        const regionCells = [];
        const stack = [{ r, c }];
        visited[r][c] = true;

        while (stack.length > 0) {
          const cell = stack.pop();
          regionCells.push(cell);

          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = cell.r + dr;
              const nc = cell.c + dc;
              if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
                if (U[nr][nc] > uThreshold && !visited[nr][nc]) {
                  visited[nr][nc] = true;
                  stack.push({ r: nr, c: nc });
                }
              }
            }
          }
        }

        if (regionCells.length > 3) {
          const cx = regionCells.reduce((sum, cell) => sum + cell.c, 0) / regionCells.length / gridCols;
          const cy = regionCells.reduce((sum, cell) => sum + cell.r, 0) / regionCells.length / gridRows;
          const size = Math.sqrt(regionCells.length / (gridCols * gridRows)) * 0.7;
          const hue = baseHue + (noise2D(regionId + 50, 500, seed + regionId * 61 + 400) - 0.5) * 0.3;

          elements.push({
            type: "cell",
            x: cx - size / 2,
            y: cy - size / 2,
            width: size,
            height: size * (0.8 + noise2D(regionId + 60, 600, seed + regionId * 71 + 400) * 0.4),
            density: 0.4 + noise2D(regionId + 70, 700, seed + regionId * 89 + 400) * 0.4,
            hue: (hue % 1 + 1) % 1,
            saturation: 0.4 + noise2D(regionId + 80, 800, seed + regionId * 97 + 400) * 0.4,
            rotation: noise2D(regionId + 90, 900, seed + regionId * 101 + 400) * Math.PI * 2,
            strength: 0.4 + noise2D(regionId + 100, 1000, seed + regionId * 109 + 400) * 0.4,
          });
          regionId++;
        }
      }
    }
  }

  // Negative space
  const negCount = 2 + Math.floor(complexity * 3);
  for (let i = 0; i < negCount; i++) {
    negativeSpace.push({
      cx: noise2D(i + 200, 200, seed + i * 113 + 450),
      cy: noise2D(i + 210, 400, seed + i * 127 + 450),
      radius: 0.05 + noise2D(i + 220, 600, seed + i * 131 + 450) * 0.1,
    });
  }

  // Compute boundaries from V field gradients for edge signal
  const boundaries = [];
  for (let r = 0; r < gridRows; r++) {
    boundaries.push(new Array(gridCols).fill(0));
  }
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      let isBoundary = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
            const diff = Math.abs(V[nr][nc] - V[r][c]);
            if (diff > 0.08) {
              isBoundary = true;
              break;
            }
          }
        }
        if (isBoundary) break;
      }
      boundaries[r][c] = isBoundary ? 1 : 0;
    }
  }

  return { elements, negativeSpace, grid: { cols: gridCols, rows: gridRows }, boundaries };
}

function composeDLA({ complexity, scale, seed }) {
  const elements = [];
  const negativeSpace = [];

  const gridCols = 32 + Math.floor(complexity * 24);
  const gridRows = Math.max(24, Math.floor(gridCols * 0.75));

  // Grid: 0 = empty, 1 = occupied
  const grid = [];
  for (let r = 0; r < gridRows; r++) {
    grid.push(new Array(gridCols).fill(0));
  }

  // Seed points - single central seed for classic DLA
  const seedCount = 1;
  const seeds = [];
  const cx = Math.floor(gridCols / 2);
  const cy = Math.floor(gridRows / 2);
  grid[cy][cx] = 1;
  seeds.push({ x: cx, y: cy });

  // Random walkers - classic DLA: start from edges, walk inward
  const walkerCount = 600 + Math.floor(complexity * 600) + Math.floor(scale * 800);
  const maxWalkSteps = 250 + Math.floor(complexity * 250) + Math.floor(scale * 300);
  const sticky = 0.25;

  for (let w = 0; w < walkerCount; w++) {
    // Start walker at random position on boundary
    const startSide = Math.floor(noise2D(w + 10, 100, seed + w * 31 + 500) * 4);
    let walkerX, walkerY;
    if (startSide === 0) { walkerX = 0; walkerY = Math.floor(noise2D(w + 20, 200, seed + w * 41 + 500) * gridRows); }
    else if (startSide === 1) { walkerX = gridCols - 1; walkerY = Math.floor(noise2D(w + 30, 300, seed + w * 43 + 500) * gridRows); }
    else if (startSide === 2) { walkerX = Math.floor(noise2D(w + 40, 400, seed + w * 47 + 500) * gridCols); walkerY = 0; }
    else { walkerX = Math.floor(noise2D(w + 50, 500, seed + w * 53 + 500) * gridCols); walkerY = gridRows - 1; }

    for (let step = 0; step < maxWalkSteps; step++) {
      // Check neighbors - if adjacent to ANY structure, stick
      let stuck = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = walkerY + dr;
          const nc = walkerX + dc;
          if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
            if (grid[nr][nc] > 0) {
              const rand = noise2D(w + 60, 600, seed + w * 59 + step * 7 + 500);
              if (rand < sticky) {
                grid[walkerY][walkerX] = 1;
                stuck = true;
                break;
              }
            }
          }
        }
        if (stuck) break;
      }
      if (stuck) break;

      // Move random walk - bias toward center
      const centerX = gridCols / 2;
      const centerY = gridRows / 2;
      const dx = centerX - walkerX;
      const dy = centerY - walkerY;
      const distToCenter = Math.hypot(dx, dy);
      const moveDir = noise2D(walkerX + walkerY + step + 70, 700, seed + w * 67 + step * 11 + 500);

      // Center bias when far from center
      const biasStrength = Math.min(distToCenter / 15, 0.35);
      if (moveDir < 0.2 - biasStrength) walkerX--;
      else if (moveDir < 0.4 - biasStrength/2) walkerX++;
      else if (moveDir < 0.6 - biasStrength/2) walkerY--;
      else if (moveDir < 0.8 - biasStrength/2) walkerY++;
      else { walkerX += 0; walkerY += 0; }

      if (walkerX < 0 || walkerX >= gridCols || walkerY < 0 || walkerY >= gridRows) break;
    }
  }

  // Extract clusters
  const visited = [];
  for (let r = 0; r < gridRows; r++) {
    visited.push(new Array(gridCols).fill(false));
  }

  const baseHue = hueFromSeed(seed + 105);
  const baseSat = satFromSeed(seed + 205);

  let clusterId = 0;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] > 0 && !visited[r][c]) {
        const clusterCells = [];
        const stack = [{ r, c }];
        visited[r][c] = true;

        while (stack.length > 0) {
          const cell = stack.pop();
          clusterCells.push(cell);

          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = cell.r + dr;
              const nc = cell.c + dc;
              if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
                if (grid[nr][nc] > 0 && !visited[nr][nc]) {
                  visited[nr][nc] = true;
                  stack.push({ r: nr, c: nc });
                }
              }
            }
          }
        }

        if (clusterCells.length > 2) {
          // For DLA: subdivide large clusters into multiple branch elements
          // by dividing the cluster's bounding box into sectors
          const minR = clusterCells.reduce((min, cell) => Math.min(min, cell.r), gridRows);
          const maxR = clusterCells.reduce((max, cell) => Math.max(max, cell.r), 0);
          const minC = clusterCells.reduce((min, cell) => Math.min(min, cell.c), gridCols);
          const maxC = clusterCells.reduce((max, cell) => Math.max(max, cell.c), 0);
          
          const sectorSize = Math.max(4, Math.min(Math.floor(Math.sqrt(clusterCells.length / 3)), 8));
          const sectorRows = Math.max(1, Math.floor((maxR - minR + 1) / sectorSize));
          const sectorCols = Math.max(1, Math.floor((maxC - minC + 1) / sectorSize));
          
          // Create a set of occupied cells for fast lookup
          const occupiedSet = new Set(clusterCells.map(c => c.r * gridCols + c.c));
          
          for (let sr = 0; sr < sectorRows; sr++) {
            for (let sc = 0; sc < sectorCols; sc++) {
              const rStart = minR + sr * sectorSize;
              const rEnd = Math.min(minR + (sr + 1) * sectorSize, maxR + 1);
              const cStart = minC + sc * sectorSize;
              const cEnd = Math.min(minC + (sc + 1) * sectorSize, maxC + 1);
              
              let sectorCount = 0;
              let sumR = 0, sumC = 0;
              for (let r = rStart; r < rEnd; r++) {
                for (let c = cStart; c < cEnd; c++) {
                  if (occupiedSet.has(r * gridCols + c)) {
                    sectorCount++;
                    sumR += r;
                    sumC += c;
                  }
                }
              }
              
              if (sectorCount > 3) {
                const cx = sumC / sectorCount / gridCols;
                const cy = sumR / sectorCount / gridRows;
                // Larger size to cover more of the DLA structure
                const size = Math.sqrt(sectorCount / (gridCols * gridRows)) * 2.5;
                const hue = baseHue + (noise2D(clusterId + 50, 500, seed + clusterId * 61 + 500) - 0.5) * 0.4;
                
                elements.push({
                  type: "cluster",
                  cx, cy,
                  width: size,
                  height: size * (0.7 + noise2D(clusterId + 60, 600, seed + clusterId * 71 + 500) * 0.6),
                  density: 0.5 + noise2D(clusterId + 70, 700, seed + clusterId * 89 + 500) * 0.5,
                  hue: (hue % 1 + 1) % 1,
                  saturation: 0.4 + noise2D(clusterId + 80, 800, seed + clusterId * 97 + 500) * 0.4,
                  rotation: noise2D(clusterId + 90, 900, seed + clusterId * 101 + 500) * Math.PI * 2,
                  strength: 0.5 + noise2D(clusterId + 100, 1000, seed + clusterId * 109 + 500) * 0.5,
                });
                clusterId++;
              }
            }
          }
        }
      }
    }
  }

  // Negative space
  const negCount = 1 + Math.floor(complexity * 2);
  for (let i = 0; i < negCount; i++) {
    negativeSpace.push({
      cx: noise2D(i + 200, 200, seed + i * 113 + 550),
      cy: noise2D(i + 210, 400, seed + i * 127 + 550),
      radius: 0.06 + noise2D(i + 220, 600, seed + i * 131 + 550) * 0.1,
    });
  }

  return { elements, negativeSpace, grid: { cols: gridCols, rows: gridRows } };
}

const COMPOSITIONS = {
  organic: { name: "Organic / Blob", fn: composeOrganicBlob },
  packing: { name: "Packing", fn: composePacking },
  voronoi: { name: "Voronoi / Cellular", fn: composeVoronoi },
  flow: { name: "Flow Field", fn: composeFlowField },
  reaction: { name: "Reaction-Diffusion", fn: composeReactionDiffusion },
  dla: { name: "DLA / Growth", fn: composeDLA },
};

const COMPOSITION_KEYS = Object.keys(COMPOSITIONS);

function getActiveComposition() {
  return COMPOSITION_KEYS[compositionIndex % COMPOSITION_KEYS.length];
}

function cycleComposition() {
  compositionIndex = (compositionIndex + 1) % COMPOSITION_KEYS.length;
  return getActiveComposition();
}

// --- Field Builder ---

function buildFieldFromComposition(composition, cols, rows, contrast) {
  const tone = new Array(cols * rows);
  const accent = new Array(cols * rows);
  const edge = new Array(cols * rows);
  const coverage = new Array(cols * rows);
  const hue = new Array(cols * rows);
  const saturation = new Array(cols * rows);

  const accentAmount = 0.75 + contrast * 0.9;

  const elements = composition.elements || [];
  const negativeSpace = composition.negativeSpace || [];

  for (let row = 0; row < rows; row++) {
    const v = rows === 1 ? 0 : row / (rows - 1);
    for (let col = 0; col < cols; col++) {
      const u = cols === 1 ? 0 : col / (cols - 1);
      const index = row * cols + col;

      let toneAccum = 0;
      let hueAccum = 0;
      let satAccum = 0;
      let weightAccum = 0;
      let edgeSignal = 0;
      let edgeWeight = 0;

      for (const el of elements) {
        let dist;
        if (el.type === "blob") {
          const dx = (u - el.cx) * Math.cos(el.rotation) + (v - el.cy) * Math.sin(el.rotation);
          const dy = -(u - el.cx) * Math.sin(el.rotation) + (v - el.cy) * Math.cos(el.rotation);
          const localX = dx / (el.width / 2);
          const localY = dy / (el.height / 2);
          dist = Math.sqrt(localX * localX + localY * localY);
        } else if (el.type === "circle") {
          dist = Math.hypot(u - el.cx, v - el.cy) / el.radius;
        } else if (el.type === "cell") {
          const inX = u >= el.x && u <= el.x + el.width;
          const inY = v >= el.y && v <= el.y + el.height;
          if (inX && inY) {
            dist = 0;
          } else {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            const hw = el.width / 2;
            const hh = el.height / 2;
            const nx = (u - cx) / hw;
            const ny = (v - cy) / hh;
            dist = Math.sqrt(nx * nx + ny * ny);
          }
        } else if (el.type === "path") {
          dist = Infinity;
          for (let i = 0; i < el.segments.length - 1; i++) {
            const s1 = el.segments[i];
            const s2 = el.segments[i + 1];
            const dx = s2.x - s1.x;
            const dy = s2.y - s1.y;
            const segLen = Math.hypot(dx, dy);
            if (segLen < 0.0001) continue;
            const t = clamp(((u - s1.x) * dx + (v - s1.y) * dy) / (segLen * segLen), 0, 1);
            const projX = s1.x + t * dx;
            const projY = s1.y + t * dy;
            const d = Math.hypot(u - projX, v - projY);
            if (d < dist) dist = d;
          }
          dist = dist / 0.08; // normalize to approximate radius
        } else if (el.type === "cluster") {
          dist = Math.hypot(u - el.cx, v - el.cy) / (el.width / 2);
        } else {
          dist = Math.hypot(u - (el.cx || 0.5), v - (el.cy || 0.5));
        }

        const envelope = clamp(1 - dist, 0, 1);
        if (envelope <= 0) continue;

        const falloff = envelope * envelope * (3 - 2 * envelope);
        const weight = el.strength * falloff;

        if (weight > 0) {
          toneAccum += el.density * weight;
          hueAccum += el.hue * weight;
          satAccum += el.saturation * weight;
          weightAccum += weight;

          if (dist > 0.7 && dist < 1.0) {
            edgeSignal += (dist - 0.7) / 0.3 * weight;
            edgeWeight += weight;
          }
        }
      }

      let negativeInfluence = 0;
      for (const neg of negativeSpace) {
        const dist = Math.hypot(u - neg.cx, v - neg.cy);
        if (dist < neg.radius) {
          negativeInfluence = Math.max(negativeInfluence, 1 - dist / neg.radius);
        }
      }

      // Add edge signal from composition boundaries (Voronoi, etc.)
      let boundaryEdge = 0;
      if (composition.boundaries && composition.grid) {
        const gc = Math.round(u * (composition.grid.cols - 1));
        const gr = Math.round(v * (composition.grid.rows - 1));
        if (gr >= 0 && gr < composition.grid.rows && gc >= 0 && gc < composition.grid.cols) {
          if (composition.boundaries[gr][gc]) {
            boundaryEdge = 1;
          }
        }
      }

      const normalizedTone = weightAccum > 0 ? toneAccum / weightAccum : 0;
      let finalTone = clamp(0.5 + normalizedTone * 0.5, 0, 1);

      // Reduce tone and coverage in negative space
      finalTone *= (1 - negativeInfluence * 0.7);

      const baseAcc = clamp(normalizedTone, 0, 1);
      // Graded coverage with base value so density gates work properly
      const finalCoverage = clamp(0.12 + normalizedTone * 0.6 + baseAcc * 0.2, 0, 1) * (1 - negativeInfluence * 0.5);

      const finalEdge = clamp(edgeWeight > 0 ? edgeSignal / edgeWeight : 0, 0, 1);

      // Combine element edges with composition boundaries
      const combinedEdge = Math.max(finalEdge, boundaryEdge);

      // Apply contrast to tone (affects renderer density gates)
      const contrastFactor = 0.5 + contrast * 1.5;
      finalTone = clamp((finalTone - 0.5) * contrastFactor + 0.5, 0, 1);

      const finalAccent = clamp((baseAcc - 0.5) * accentAmount + 0.5, 0, 1);

      const finalHue = weightAccum > 0 ? hueAccum / weightAccum : 0.5;
      const finalSat = weightAccum > 0 ? satAccum / weightAccum : 0.5;

      tone[index] = finalTone;
      accent[index] = finalAccent;
      edge[index] = combinedEdge;
      coverage[index] = finalCoverage;
      hue[index] = finalHue;
      saturation[index] = finalSat;
    }
  }

  return { width: cols, height: rows, tone, accent, edge, coverage, hue, saturation };
}

// --- Pattern Renderers ---

function ditherOffset(col, row, seed) {
  const dither = DITHER_TYPES[DITHER_TYPE];
  const matrix = dither.matrix;
  const size = matrix.length;
  const seedPhase = Math.floor(seed * 1000) % size;
  const x = (col + seedPhase) % size;
  const y = (row + seedPhase) % size;
  return (matrix[y][x] + 0.5) / (size * size) - 0.5;
}

function resolveArtworkColor({ hue, saturation, value, contrast }) {
  const v = clamp((value - 0.5) * (0.8 + contrast * 0.4) + 0.5, 0, 1);
  const s = saturation;
  const h = hue;
  const c = v * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  const sector = Math.floor(h * 6);
  switch (sector) {
    case 0: r = c; g = x; b = 0; break;
    case 1: r = x; g = c; b = 0; break;
    case 2: r = 0; g = c; b = x; break;
    case 3: r = 0; g = x; b = c; break;
    case 4: r = x; g = 0; b = c; break;
    case 5: r = c; g = 0; b = x; break;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  return 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

function getFieldSample(field, col, row) {
  const index = row * field.width + col;
  return {
    tone: field.tone[index],
    accent: field.accent[index],
    edge: field.edge[index],
    coverage: field.coverage[index],
    hue: field.hue[index],
    saturation: field.saturation[index],
  };
}

function renderDitherPattern({ field, density, contrast, seed, scale, svgWidth, svgHeight }) {
  const cols = field.width;
  const rows = field.height;
  const cellW = svgWidth / cols;
  const cellH = svgHeight / rows;
  // Scale affects font size more strongly
  const fontSize = Math.max(5, Math.round(Math.min(cellW, cellH) * (0.5 + (scale / 100) * 0.6)));
  const charH = fontSize * 1.1;
  const chars = VARIATIONS[variationSelect.value].chars;
  const elements = [];

  // Density gate: steeper curve, more sensitive to density
  // Contrast affects tone threshold
  const contrastToneBoost = contrast * 0.15;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sample = getFieldSample(field, col, row);
      const tone = clamp(sample.tone, 0, 1);
      // Density gate: steeper, uses tone directly + coverage
      const densityGate = Math.pow(1 - density, 1.5) * 0.7 + sample.edge * 0.05;
      const effectiveTone = tone + contrastToneBoost;
      const effectiveCoverage = sample.coverage + effectiveTone * 0.2;
      if (effectiveCoverage < densityGate) continue;
      if (effectiveTone < 0.05 + (1 - density) * 0.15) continue;

      const char = pickChar(variationSelect.value, chars, col, row, tone, seed);
      if (!char || char === " ") continue;

      const fill = resolveArtworkColor({
        hue: sample.hue,
        saturation: sample.saturation,
        value: clamp(sample.tone + ditherOffset(col, row, seed), 0, 1),
        contrast,
      });
      const x = (col + 0.5) * cellW;
      const y = row * cellH + charH * 0.7;

      elements.push(
        '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="' + fill + '" font-size="' + fontSize + '" font-family=\'SF Mono\', Menlo, Consolas, monospace" text-anchor="middle">' + escapeXml(char) + '</text>'
      );
    }
  }
  return elements;
}

function renderPixelPattern({ field, density, contrast, scale, svgWidth, svgHeight }) {
  const cols = field.width;
  const rows = field.height;
  const cellW = svgWidth / cols;
  const cellH = svgHeight / rows;
  const elements = [];

  // Contrast boost for tone threshold
  const contrastToneBoost = contrast * 0.15;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sample = getFieldSample(field, col, row);
      const tone = clamp(sample.tone, 0, 1);
      // Density gate: steeper curve
      const densityGate = Math.pow(1 - density, 1.5) * 0.75 + sample.edge * 0.06;
      const effectiveTone = tone + contrast * 0.15;
      const effectiveCoverage = sample.coverage + tone * 0.25;
      if (effectiveCoverage < densityGate) continue;
      if (effectiveTone < 0.05 + (1 - density) * 0.18) continue;

      const fill = resolveArtworkColor({
        hue: sample.hue,
        saturation: sample.saturation,
        value: tone,
        contrast,
      });

      // Scale affects block size more strongly
      const scaleFactor = 0.5 + (scale / 100) * 0.8;
      const blockFactor = scaleFactor + tone * 0.5;
      const w = cellW * (0.7 + blockFactor * 0.4);
      const h = cellH * (0.7 + blockFactor * 0.4);
      const x = col * cellW + (cellW - w) / 2;
      const y = row * cellH + (cellH - h) / 2;

      elements.push(
        '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + fill + '"/>'
      );
    }
  }
  return elements;
}

function renderBlobPattern({ field, density, contrast, scale, svgWidth, svgHeight }) {
  const cols = field.width;
  const rows = field.height;
  const cellW = svgWidth / cols;
  const cellH = svgHeight / rows;
  // Scale has stronger effect on form size
  const formScale = 0.5 + (scale / 100) * 1.0;
  const elements = [];

  const contrastToneBoost = contrast * 0.15;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sample = getFieldSample(field, col, row);
      const tone = clamp(sample.tone, 0, 1);
      // Density gate: steeper curve
      const densityGate = Math.pow(1 - density, 1.5) * 0.65 + sample.edge * 0.05;
      const effectiveTone = tone + contrastToneBoost;
      const effectiveCoverage = sample.coverage + tone * 0.3;
      if (effectiveCoverage < densityGate) continue;
      if (effectiveTone < 0.06 + (1 - density) * 0.18) continue;

      const fill = resolveArtworkColor({
        hue: sample.hue,
        saturation: sample.saturation,
        value: tone,
        contrast,
      });
      // Scale affects blob size more strongly
      const rx = cellW * (0.4 + tone * 0.8) * formScale;
      const ry = cellH * (0.4 + tone * 0.8) * formScale;
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;

      const safeRx = Math.min(rx, cx, svgWidth - cx);
      const safeRy = Math.min(ry, cy, svgHeight - cy);

      if (safeRx < 2 || safeRy < 2) continue;

      elements.push(
        '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + safeRx.toFixed(1) + '" ry="' + safeRy.toFixed(1) + '" fill="' + fill + '"/>'
      );
    }
  }
  return elements;
}

function renderDotGridPattern({ field, density, contrast, scale, svgWidth, svgHeight }) {
  const cols = field.width;
  const rows = field.height;
  const spacingX = svgWidth / cols;
  const spacingY = svgHeight / rows;
  // Scale has stronger effect on dot size
  const maxRadius = Math.min(spacingX, spacingY) * 0.35 * (0.5 + (scale / 100) * 0.8);
  const elements = [];

  const contrastToneBoost = contrast * 0.15;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sample = getFieldSample(field, col, row);
      const tone = clamp(sample.tone, 0, 1);

      // Density gate: steeper curve
      const densityGate = Math.pow(1 - density, 1.5) * 0.7 + sample.edge * 0.05;
      const effectiveTone = tone + contrastToneBoost;
      const effectiveCoverage = sample.coverage + tone * 0.25;
      if (effectiveCoverage < densityGate) continue;
      if (effectiveTone < 0.05 + (1 - density) * 0.15) continue;

      const fill = resolveArtworkColor({
        hue: sample.hue,
        saturation: sample.saturation,
        value: tone,
        contrast,
      });
      const radius = maxRadius * (0.08 + tone * 0.92);
      if (radius < 0.5) continue;

      const cx = col * spacingX + spacingX / 2;
      const cy = row * spacingY + spacingY / 2;
      elements.push(
        '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + radius.toFixed(1) + '" fill="' + fill + '"/>'
      );
    }
  }
  return elements;
}

const PATTERN_RENDERERS = {
  dither: renderDitherPattern,
  pixel: renderPixelPattern,
  blob: renderBlobPattern,
  "dot-grid": renderDotGridPattern,
};

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(newSeed) {
  if (newSeed) {
    seed = Math.random() * 10000;
    compositionIndex = Math.floor(seed % COMPOSITION_KEYS.length);
  }

  const density = Number(document.getElementById("density").value) / 100;
  const scale = Number(document.getElementById("scale").value);
  const complexity = Number(document.getElementById("complexity").value);
  const contrast = Number(document.getElementById("contrast").value) / 100;
  const variation = variationSelect.value;
  const pattern = patternSelect.value;

  const [rw, rh] = selectedRatio.split(":").map(Number);
  svgWidth = RESOLUTION;
  svgHeight = Math.round(RESOLUTION * (rh / rw));

  const fieldDims = getBaseFieldDimensions(rw, rh, density);

  const compositionKey = getActiveComposition();
  const composition = COMPOSITIONS[compositionKey].fn({
    complexity: complexity / 100,
    scale: scale / 100,
    seed,
  });

  const baseField = buildFieldFromComposition(composition, fieldDims.cols, fieldDims.rows, contrast);

  const context = {
    field: baseField,
    density,
    contrast,
    scale,
    seed,
    svgWidth,
    svgHeight,
  };

  const renderPattern = PATTERN_RENDERERS[pattern] || renderDitherPattern;
  const elements = renderPattern(context);

  const compositionName = COMPOSITIONS[compositionKey].name;

  currentSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgWidth + '" height="' + svgHeight + '" viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '">'
    + '<rect width="100%" height="100%" fill="#ffffff"/>'
    + elements.join("\n  ")
    + '</svg>';

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
    link.download = 'microgenerator.' + format;
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