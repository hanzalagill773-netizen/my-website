import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

/* ------------------------------------------------------------------ */
/* Style + room data — each style defines 6 rooms on a 3x2 grid,       */
/* repeated identically on both floors:                                */
/*   back-left | back-center | back-right                              */
/*   front-left| front-center| front-right   (front = entrance side)   */
/* ------------------------------------------------------------------ */

const STYLES = {
  modern: {
    label: "Modern",
    wallColor: 0xd6dade,
    trimColor: 0x2b2f33,
    roofColor: 0x33383d,
    roofStyle: "flat",
    glassBand: true,
    porch: false,
    accent: 0xc9a227,
    rooms: [
      { room: "Kitchen", items: ["Kitchen island counter"] },
      { room: "Washroom", items: ["Floating vanity sink", "Wall-mounted toilet", "Walk-in glass shower"] },
      { room: "Bedroom", items: ["Platform bed frame"] },
      { room: "Home Office", items: ["Floating shelving unit", "Study desk"] },
      { room: "Lounge", items: ["Low-profile sectional sofa", "Glass coffee table"] },
      { room: "Dining", items: ["Glass-top dining table"] },
    ],
  },
  farmhouse: {
    label: "Farmhouse",
    wallColor: 0xf3eee2,
    trimColor: 0x2a2a2a,
    roofColor: 0x384249,
    roofStyle: "gable-steep",
    glassBand: false,
    porch: true,
    accent: 0x8a5a3b,
    rooms: [
      { room: "Kitchen", items: ["Shaker-style cabinetry"] },
      { room: "Washroom", items: ["Pedestal sink", "Classic toilet", "Clawfoot tub"] },
      { room: "Bedroom", items: ["Cottage bed frame"] },
      { room: "Mudroom", items: ["Built-in bench & storage"] },
      { room: "Lounge", items: ["Slipcovered sofa"] },
      { room: "Dining", items: ["Farmhouse trestle table"] },
    ],
  },
  colonial: {
    label: "Colonial",
    wallColor: 0xa3453a,
    trimColor: 0xf5f2ea,
    roofColor: 0x2e2b28,
    roofStyle: "gable",
    glassBand: false,
    porch: false,
    columns: true,
    accent: 0x5b7a8c,
    rooms: [
      { room: "Kitchen", items: ["Traditional raised-panel cabinetry"] },
      { room: "Washroom", items: ["Pedestal sink", "Classic toilet", "Clawfoot tub"] },
      { room: "Bedroom", items: ["Four-poster bed"] },
      { room: "Study", items: ["Built-in bookcases"] },
      { room: "Lounge", items: ["Wingback armchairs"] },
      { room: "Dining", items: ["Pedestal dining table"] },
    ],
  },
  minimalist: {
    label: "Minimalist",
    wallColor: 0xe8e7e3,
    trimColor: 0xb9b7b1,
    roofColor: 0xc2c0ba,
    roofStyle: "flat",
    glassBand: false,
    porch: false,
    accent: 0x9a958a,
    rooms: [
      { room: "Kitchen", items: ["Integrated flat-panel cabinetry"] },
      { room: "Washroom", items: ["Floating vanity sink", "Wall-mounted toilet", "Walk-in glass shower"] },
      { room: "Bedroom", items: ["Low platform bed"] },
      { room: "Utility", items: ["Built-in wall storage"] },
      { room: "Lounge", items: ["Modular sofa, single tone"] },
      { room: "Dining", items: ["Fold-away dining table"] },
    ],
  },
};

function flattenRooms(style) {
  return style.rooms.flatMap((r) => r.items.map((item) => [r.room, item]));
}

/* ------------------------------------------------------------------ */
/* Recommendation logic                                                 */
/* ------------------------------------------------------------------ */

function recommendStyle(widthFt, lengthFt) {
  const w = Math.min(widthFt, lengthFt);
  const l = Math.max(widthFt, lengthFt);
  const ratio = l / w;
  const area = widthFt * lengthFt;

  if (area <= 1600) {
    return { key: "minimalist", reason: `At ${area.toLocaleString()} sq ft, this plot rewards an efficient, compact footprint rather than deep massing. A minimalist cube form keeps every foot of the plot usable.` };
  }
  if (ratio >= 2.1) {
    return { key: "farmhouse", reason: `The plot is long and narrow (about ${ratio.toFixed(1)}:1). A linear farmhouse plan with a wraparound porch reads well along the short frontage and makes use of the depth.` };
  }
  if (area >= 3400 && ratio < 1.45) {
    return { key: "colonial", reason: `At ${area.toLocaleString()} sq ft on a near-square plot, there's enough width for a symmetric colonial layout with a formal, centered entry.` };
  }
  return { key: "modern", reason: `A balanced plot of ${widthFt} × ${lengthFt} ft, without an extreme ratio or size, suits an open modern plan with flexible massing.` };
}

/* ------------------------------------------------------------------ */
/* Furniture suggestions (per room, based on room size)                 */
/* ------------------------------------------------------------------ */

const ROOM_TIPS = {
  kitchen: (sqft) => sqft < 70
    ? "Compact footprint — a single-run counter with slim wall cabinets keeps it efficient without feeling cramped."
    : "Enough room for an L-shaped counter or a small island for extra prep space.",
  washroom: (sqft) => sqft < 40
    ? "Tight footprint — a corner shower and wall-mounted sink free up floor space."
    : "Comfortable enough for a standard tub plus separate vanity.",
  bedroom: (sqft) => sqft < 100
    ? "Choose a platform bed without a bulky frame, and built-in wardrobes instead of freestanding ones."
    : "Fits a queen or king bed comfortably, plus a reading chair or bench at the foot.",
  lounge: (sqft) => sqft < 130
    ? "A loveseat or two-seater sofa with a slim console table suits this footprint better than a large sectional."
    : "Spacious enough for a full sectional and a proper coffee table without crowding walkways.",
  dining: (sqft) => sqft < 80
    ? "A round or drop-leaf table seats 4 without dominating the room."
    : "Comfortably fits a 6-seat table with room to pull chairs out.",
  "home office": () => "A wall-mounted desk and floating shelves keep the floor clear for movement.",
  study: () => "Built-in bookcases along one wall leave the room open for a reading chair.",
  mudroom: () => "Built-in bench seating with cubbies above works better here than freestanding furniture.",
  utility: () => "Slim built-in storage along one wall keeps this space fully functional.",
  garage: () => "Wall-mounted shelving keeps the floor clear for the car and makes better use of vertical space.",
};

function tipForRoom(roomName, sqft) {
  const key = roomName.toLowerCase();
  const fn = ROOM_TIPS[key];
  if (fn) return fn(sqft);
  return "Keep furniture scaled to the room's footprint and leave at least 30in of clear walking path.";
}

function renderFurnitureTips(style, cellWFt, cellDFt) {
  const sqft = cellWFt * cellDFt;
  const seen = new Set();
  const cards = [];
  style.rooms.forEach((r) => {
    if (seen.has(r.room)) return;
    seen.add(r.room);
    cards.push({ room: r.room, tip: tipForRoom(r.room, sqft), sqft: Math.round(sqft) });
  });
  cards.push({ room: "Garage", tip: tipForRoom("garage", 0), sqft: null });

  tipsGrid.innerHTML = cards.map((c) => `
    <div class="tip-card">
      <h4>${c.room}${c.sqft ? ` <span style="color:var(--muted-dim); font-weight:400; font-size:11px;">(~${c.sqft} sq ft/room)</span>` : ""}</h4>
      <p>${c.tip}</p>
    </div>
  `).join("");
}

/* ------------------------------------------------------------------ */
/* Rough construction cost estimate (illustrative only)                 */
/* ------------------------------------------------------------------ */

const COST_PER_SQFT = { minimalist: 110, farmhouse: 130, modern: 145, colonial: 165 };
const GARAGE_FLAT_COST = 16000;

function fmtUsd(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function renderCostEstimate(widthFt, lengthFt, styleKey) {
  const houseWFt = widthFt * 0.62;
  const houseLFt = lengthFt * 0.55;
  const floorAreaSqFt = houseWFt * houseLFt;
  const totalLivingArea = floorAreaSqFt * 2;
  const rate = COST_PER_SQFT[styleKey] || 130;
  const shellCost = totalLivingArea * rate;
  const total = shellCost + GARAGE_FLAT_COST;

  costEmpty.style.display = "none";
  costBody.style.display = "block";
  costRows.innerHTML = `
    <div class="cost-row"><span class="label">Living area (both floors)</span><span class="value">${Math.round(totalLivingArea).toLocaleString()} sq ft</span></div>
    <div class="cost-row"><span class="label">${STYLES[styleKey].label} build rate</span><span class="value">${fmtUsd(rate)} / sq ft</span></div>
    <div class="cost-row"><span class="label">Shell &amp; finishes</span><span class="value">${fmtUsd(shellCost)}</span></div>
    <div class="cost-row"><span class="label">Garage (flat estimate)</span><span class="value">${fmtUsd(GARAGE_FLAT_COST)}</span></div>
    <div class="cost-row total"><span class="label">Estimated total</span><span class="value">${fmtUsd(total)}</span></div>
  `;
}

/* ------------------------------------------------------------------ */
/* Floor plan (2D dimensioned drawing)                                  */
/* ------------------------------------------------------------------ */

function layoutRows(rowsDef, totalDepth, width) {
  const totalWeight = rowsDef.reduce((s, r) => s + r.reduce((rs, x) => rs + x.weight, 0), 0);
  let yCursor = 0;
  const rooms = [];
  rowsDef.forEach((row) => {
    const rowWeight = row.reduce((s, x) => s + x.weight, 0);
    const rowDepth = (rowWeight / totalWeight) * totalDepth;
    let xCursor = 0;
    row.forEach((item) => {
      const itemWidth = (item.weight / rowWeight) * width;
      rooms.push({ name: item.name, x: xCursor, y: yCursor, w: itemWidth, h: rowDepth, type: item.type });
      xCursor += itemWidth;
    });
    yCursor += rowDepth;
  });
  return rooms;
}

function computeFloorPlan(widthFt, lengthFt) {
  const area = widthFt * lengthFt;
  const twoFloors = area > 1400;
  const floors = [];

  const groundRows = [];
  groundRows.push([{ name: "Staircase", weight: 1.0, type: "stair" }]);
  groundRows.push([{ name: "Bedroom", weight: 2.6, type: "bedroom" }, { name: "Toilet", weight: 0.9, type: "toilet" }]);
  groundRows.push([{ name: "Kitchen", weight: 2.0, type: "kitchen" }, { name: "Wash Area", weight: 1.0, type: "wash" }]);
  groundRows.push([{ name: "Living Room", weight: 4.4, type: "living" }]);
  if (widthFt >= 16) groundRows.push([{ name: "Parking", weight: 3.0, type: "parking" }]);
  floors.push({ label: twoFloors ? "Ground Floor" : "Floor Plan", rooms: layoutRows(groundRows, lengthFt, widthFt) });

  if (twoFloors) {
    const upperRows = [];
    upperRows.push([{ name: "Bedroom", weight: 2.8, type: "bedroom" }, { name: "Toilet", weight: 0.8, type: "toilet" }]);
    upperRows.push([{ name: "Lobby", weight: 1.6, type: "lobby" }, { name: "Dress", weight: 0.6, type: "dress" }]);
    upperRows.push([{ name: "Bedroom", weight: 2.8, type: "bedroom" }, { name: "Toilet", weight: 0.8, type: "toilet" }]);
    upperRows.push([{ name: "Balcony", weight: 1.2, type: "balcony" }]);
    floors.push({ label: "First Floor", rooms: layoutRows(upperRows, lengthFt, widthFt) });
  }
  return floors;
}

function dimensionLine(x1, y1, x2, y2, label, horizontal, tick) {
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7f95ab" stroke-width="0.025"/>`;
  if (horizontal) {
    s += `<line x1="${x1}" y1="${y1 - tick}" x2="${x1}" y2="${y1 + tick}" stroke="#7f95ab" stroke-width="0.025"/>`;
    s += `<line x1="${x2}" y1="${y2 - tick}" x2="${x2}" y2="${y2 + tick}" stroke="#7f95ab" stroke-width="0.025"/>`;
    s += `<text x="${(x1 + x2) / 2}" y="${y1 - tick * 1.6}" fill="#c9a227" font-size="${tick * 5.5}" text-anchor="middle">${label}</text>`;
  } else {
    s += `<line x1="${x1 - tick}" y1="${y1}" x2="${x1 + tick}" y2="${y1}" stroke="#7f95ab" stroke-width="0.025"/>`;
    s += `<line x1="${x2 - tick}" y1="${y2}" x2="${x2 + tick}" y2="${y2}" stroke="#7f95ab" stroke-width="0.025"/>`;
    s += `<text x="${x1 - tick * 1.8}" y="${(y1 + y2) / 2}" fill="#c9a227" font-size="${tick * 5.5}" text-anchor="middle" transform="rotate(-90 ${x1 - tick * 1.8} ${(y1 + y2) / 2})">${label}</text>`;
  }
  return s;
}

const ROOM_FILL = { parking: "#20361f", living: "#152436", kitchen: "#2c2716", wash: "#16232c", toilet: "#16232c", bedroom: "#17222f", stair: "#20242b", balcony: "#1c2a22", lobby: "#182430", dress: "#1e2430" };
const HATCH_TYPES = new Set(["parking", "wash", "toilet"]);

function svgForFloor(floor, widthFt, lengthFt) {
  const m = Math.max(widthFt, lengthFt) * 0.09;
  const totalW = widthFt + m * 2;
  const totalH = lengthFt + m * 2 + m * 0.9;
  const ox = m, oy = m;

  let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" font-family="monospace">`;
  svg += `<defs><pattern id="hatch" width="0.6" height="0.6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="0.6" stroke="#3a5568" stroke-width="0.08"/></pattern></defs>`;
  svg += `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#0f1c2c"/>`;
  svg += `<rect x="${ox}" y="${oy}" width="${widthFt}" height="${lengthFt}" fill="none" stroke="#c9a227" stroke-width="0.06"/>`;

  floor.rooms.forEach((r) => {
    const rx = ox + r.x, ry = oy + r.y;
    const fill = ROOM_FILL[r.type] || "#182430";
    svg += `<rect x="${rx}" y="${ry}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="#5b7a99" stroke-width="0.035"/>`;
    if (HATCH_TYPES.has(r.type)) svg += `<rect x="${rx}" y="${ry}" width="${r.w}" height="${r.h}" fill="url(#hatch)" opacity="0.55"/>`;
    if (r.type === "stair") {
      const steps = 6;
      for (let s = 1; s < steps; s++) {
        const yy = ry + (r.h * s) / steps;
        svg += `<line x1="${rx}" y1="${yy}" x2="${rx + r.w}" y2="${yy}" stroke="#3a5568" stroke-width="0.02"/>`;
      }
      svg += `<text x="${rx + r.w / 2}" y="${ry + r.h * 0.5}" fill="#e8c94f" font-size="${Math.min(r.w, r.h) * 0.28}" text-anchor="middle" dominant-baseline="middle">UP</text>`;
    }
    const fontSize = Math.min(r.w, r.h) * 0.16;
    svg += `<text x="${rx + r.w / 2}" y="${ry + r.h / 2 - fontSize * 0.3}" fill="#eef1f4" font-size="${fontSize}" text-anchor="middle" font-weight="600">${r.name}</text>`;
    svg += `<text x="${rx + r.w / 2}" y="${ry + r.h / 2 + fontSize * 0.9}" fill="#9fb3c8" font-size="${fontSize * 0.75}" text-anchor="middle">${r.w.toFixed(1)}' × ${r.h.toFixed(1)}'</text>`;
  });

  svg += dimensionLine(ox, oy - m * 0.4, ox + widthFt, oy - m * 0.4, `${widthFt}'`, true, m * 0.08);
  svg += dimensionLine(ox - m * 0.4, oy, ox - m * 0.4, oy + lengthFt, `${lengthFt}'`, false, m * 0.08);

  const cx = ox + widthFt / 2;
  const arrowY = oy + lengthFt + m * 0.15;
  svg += `<polygon points="${cx - m * 0.12},${arrowY + m * 0.3} ${cx + m * 0.12},${arrowY + m * 0.3} ${cx},${arrowY}" fill="#c9a227"/>`;
  svg += `<text x="${cx}" y="${arrowY + m * 0.62}" fill="#eef1f4" font-size="${m * 0.22}" text-anchor="middle" letter-spacing="0.05">MAIN ENTRANCE</text>`;
  svg += `</svg>`;
  return svg;
}

function summarizeFloors(floors) {
  const counts = {};
  floors.forEach((f) => f.rooms.forEach((r) => { if (r.type !== "stair") counts[r.name] = (counts[r.name] || 0) + 1; }));
  const parts = Object.entries(counts).map(([name, n]) => `<strong>${n}</strong> ${name}${n > 1 ? "s" : ""}`);
  return `This plot fits: ${parts.join(" · ")}.`;
}

let currentFloorPlans = [];
let activeFloorIdx = 0;
const floorTabs = document.getElementById("floorTabs");
const floorPlanHost = document.getElementById("floorPlanHost");
const floorSummary = document.getElementById("floorSummary");
const tipsGrid = document.getElementById("tipsGrid");
const costEmpty = document.getElementById("costEmpty");
const costBody = document.getElementById("costBody");
const costRows = document.getElementById("costRows");

function renderFloorPlanUI() {
  floorTabs.innerHTML = "";
  currentFloorPlans.forEach((floor, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "floor-tab" + (idx === activeFloorIdx ? " active" : "");
    btn.textContent = floor.label;
    btn.addEventListener("click", () => { activeFloorIdx = idx; renderFloorPlanUI(); });
    floorTabs.appendChild(btn);
  });
  const floor = currentFloorPlans[activeFloorIdx];
  floorPlanHost.innerHTML = floor ? svgForFloor(floor, currentPlot.w, currentPlot.l) : "";
  floorSummary.innerHTML = currentFloorPlans.length ? summarizeFloors(currentFloorPlans) : "";
}

/* ------------------------------------------------------------------ */
/* Scene setup                                                         */
/* ------------------------------------------------------------------ */

const FT = 0.09;

/* ---- procedural textures — reduce the flat "cartoon" look without needing
   external image assets ---- */

function colorToCss(hex) {
  return `#${hex.toString(16).padStart(6, "0")}`;
}
function shade(hex, amt) {
  const r = Math.min(255, Math.max(0, ((hex >> 16) & 0xff) + amt));
  const g = Math.min(255, Math.max(0, ((hex >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (hex & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
}

function makeGrassTexture(baseHex) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorToCss(baseHex);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const shadeAmt = (Math.random() - 0.5) * 40;
    ctx.fillStyle = colorToCss(shade(baseHex, shadeAmt));
    ctx.globalAlpha = 0.5;
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillRect(x, y, 1.5, 3);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFloorTexture(baseHex, plankAxis, boardCount) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorToCss(baseHex);
  ctx.fillRect(0, 0, size, size);
  const lineColor = colorToCss(shade(baseHex, -35));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  const step = size / boardCount;
  for (let i = 1; i < boardCount; i++) {
    ctx.beginPath();
    if (plankAxis === "h") { ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); }
    else { ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); }
    ctx.stroke();
  }
  // subtle grain streaks
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`;
    ctx.beginPath();
    const pos = Math.random() * size;
    if (plankAxis === "h") { ctx.moveTo(0, pos); ctx.lineTo(size, pos + (Math.random() - 0.5) * 4); }
    else { ctx.moveTo(pos, 0); ctx.lineTo(pos + (Math.random() - 0.5) * 4, size); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBrickTexture(baseHex, mortarHex) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorToCss(mortarHex);
  ctx.fillRect(0, 0, size, size);
  const rows = 8, brickH = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : brickH * 1.5;
    for (let x = -brickH * 1.5; x < size + brickH * 1.5; x += brickH * 3) {
      ctx.fillStyle = colorToCss(shade(baseHex, (Math.random() - 0.5) * 18));
      ctx.fillRect(x + offset, r * brickH, brickH * 2.85, brickH * 0.86);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeSidingTexture(baseHex) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorToCss(baseHex);
  ctx.fillRect(0, 0, size, size);
  const rows = 10, rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = colorToCss(shade(baseHex, r % 2 === 0 ? -8 : 4));
    ctx.fillRect(0, r * rowH, size, rowH);
    ctx.strokeStyle = colorToCss(shade(baseHex, -30));
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, r * rowH); ctx.lineTo(size, r * rowH); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wallMaterialForStyle(styleKey, colorHex) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  let tex;
  if (styleKey === "colonial") tex = makeBrickTexture(colorHex, shade(colorHex, -70));
  else tex = makeSidingTexture(colorHex);
  tex.repeat.set(4, 2);
  mat.map = tex;
  return mat;
}

function floorMaterialForRoom(colorHex, cellWFt, cellDFt) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
  const tex = makeFloorTexture(colorHex, "h", 7);
  tex.repeat.set(Math.max(1, Math.round(cellWFt / 6)), Math.max(1, Math.round(cellDFt / 6)));
  mat.map = tex;
  return mat;
}


const host = document.getElementById("canvasHost");
const emptyState = document.getElementById("emptyState");
const canvasHint = document.getElementById("canvasHint");
const viewToggleGroup = document.getElementById("viewToggleGroup");
const walkOverlay = document.getElementById("walkOverlay");
const walkExitHint = document.getElementById("walkExitHint");

let renderer, scene, camera, controls;
let houseGroup = null;
let groundGroup = null;
let currentStyleKey = "modern";
let currentPlot = { w: 40, l: 70 };
let initialized = false;
let cameraTween = null;
const clock = new THREE.Clock();

let walkControls = null;
let walkActive = false;
const walkKeys = { forward: false, backward: false, left: false, right: false };
const walkSpeed = 1.3;

function initScene() {
  if (initialized) return;
  initialized = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe0f2);
  scene.fog = new THREE.Fog(0xdcedf5, 22, 60);

  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 200);
  camera.position.set(10, 8, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 1, 0);

  const hemi = new THREE.HemisphereLight(0xdcedf7, 0x5c7a4a, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3d6, 1.4);
  sun.position.set(12, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xaecbe0, 0.35);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0x3a4a55, 0.35));

  buildDistantHills();

  initWalkControls();
  window.addEventListener("resize", onResize);
  animate();
}

function buildDistantHills() {
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x8fa8b8, roughness: 1, fog: true });
  const positions = [
    [-22, 0, -34, 9, 3.2], [-6, 0, -38, 11, 3.8], [12, 0, -35, 10, 3.4],
    [26, 0, -30, 8, 2.8], [-34, 0, -20, 7, 2.6], [34, 0, -18, 7, 2.6],
  ];
  positions.forEach(([x, y, z, radius, height]) => {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    hill.scale.y = height / radius;
    hill.position.set(x, y, z);
    scene.add(hill);
  });
}

function initWalkControls() {
  walkControls = new PointerLockControls(camera, renderer.domElement);
  walkControls.addEventListener("lock", () => {
    walkOverlay.classList.remove("show");
    walkExitHint.classList.add("show");
  });
  walkControls.addEventListener("unlock", () => {
    if (walkActive) walkOverlay.classList.add("show");
  });
}

function onResize() {
  if (!renderer) return;
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  if (walkActive) updateWalkMovement(delta);
  else controls.update();
  if (cameraTween) cameraTween();
  renderer.render(scene, camera);
}

function tweenCamera(toPos, toTarget, duration = 700) {
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const start = performance.now();
  cameraTween = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(fromPos, toPos, eased);
    controls.target.lerpVectors(fromTarget, toTarget, eased);
    controls.update();
    if (t >= 1) cameraTween = null;
  };
}

/* ---- walkthrough movement + collision (ground footprint, either level) ---- */

let walkLevel = 0; // 0 = ground, 1 = upper

function insideBounds(pos, level) {
  const zones = houseGroup.userData.walkZones || [];
  const margin = 0.1;
  return zones.some((z) => {
    if (z.groundOnly && level !== 0) return false;
    return pos.x > z.minX + margin && pos.x < z.maxX - margin && pos.z > z.minZ + margin && pos.z < z.maxZ - margin;
  });
}

function collides(pos) {
  const obstacles = houseGroup.userData.wallObstacles || [];
  const r = 0.13;
  return obstacles.some((o) => pos.x + r > o.minX && pos.x - r < o.maxX && pos.z + r > o.minZ && pos.z - r < o.maxZ);
}

function updateWalkMovement(delta) {
  if (!walkControls || !walkControls.isLocked || !houseGroup) return;
  const step = walkSpeed * delta;
  const prev = camera.position.clone();

  if (walkKeys.forward) walkControls.moveForward(step);
  if (walkKeys.backward) walkControls.moveForward(-step);
  if (walkKeys.right) walkControls.moveRight(step);
  if (walkKeys.left) walkControls.moveRight(-step);

  const eyeY = walkLevel === 0 ? houseGroup.userData.eyeHeightGround : houseGroup.userData.eyeHeightUpper;
  camera.position.y = eyeY;

  if (!insideBounds(camera.position, walkLevel) || collides(camera.position)) {
    camera.position.copy(prev);
    camera.position.y = eyeY;
  }
}

document.addEventListener("keydown", (e) => {
  if (!walkActive) return;
  switch (e.code) {
    case "KeyW": case "ArrowUp": walkKeys.forward = true; break;
    case "KeyS": case "ArrowDown": walkKeys.backward = true; break;
    case "KeyA": case "ArrowLeft": walkKeys.left = true; break;
    case "KeyD": case "ArrowRight": walkKeys.right = true; break;
    case "Digit1": walkLevel = 0; camera.position.y = houseGroup.userData.eyeHeightGround; break;
    case "Digit2": walkLevel = 1; camera.position.y = houseGroup.userData.eyeHeightUpper; break;
    case "Escape": exitWalkthrough(); break;
  }
});
document.addEventListener("keyup", (e) => {
  switch (e.code) {
    case "KeyW": case "ArrowUp": walkKeys.forward = false; break;
    case "KeyS": case "ArrowDown": walkKeys.backward = false; break;
    case "KeyA": case "ArrowLeft": walkKeys.left = false; break;
    case "KeyD": case "ArrowRight": walkKeys.right = false; break;
  }
});

/* ------------------------------------------------------------------ */
/* Ground + landscaping                                                 */
/* ------------------------------------------------------------------ */

function buildGround(widthFt, lengthFt) {
  if (groundGroup) { scene.remove(groundGroup); disposeGroup(groundGroup); }
  groundGroup = new THREE.Group();

  const w = widthFt * FT;
  const l = lengthFt * FT;
  const padW = w + 7;
  const padL = l + 7;

  const grassTex = makeGrassTexture(0x5f8a4d);
  grassTex.repeat.set(Math.max(2, Math.round(widthFt / 8)), Math.max(2, Math.round(lengthFt / 8)));
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(padW, padL), grassMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  groundGroup.add(groundMesh);

  const outlinePts = [
    new THREE.Vector3(-w / 2, 0.012, -l / 2), new THREE.Vector3(w / 2, 0.012, -l / 2),
    new THREE.Vector3(w / 2, 0.012, l / 2), new THREE.Vector3(-w / 2, 0.012, l / 2),
    new THREE.Vector3(-w / 2, 0.012, -l / 2),
  ];
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePts), new THREE.LineDashedMaterial({ color: 0xc9a227, dashSize: 0.16, gapSize: 0.09 }));
  outline.computeLineDistances();
  groundGroup.add(outline);

  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    if (i > 1 && (w < 3 || l < 3)) return;
    const tx = sx * (w / 2 - 0.4);
    const tz = sz * (l / 2 - 0.4);
    if (Math.abs(tx) < w * 0.32 && Math.abs(tz) < l * 0.32) return;
    if (sx < 0) return; // keep the left side clear for the garage
    groundGroup.add(makeTree(tx, tz));
  });

  // driveway leading to the garage (mirrors buildGarage's own geometry formula
  // so it always lines up with the garage door regardless of plot size)
  const houseW = w * 0.62;
  const houseL = l * 0.55;
  const garageW = houseW * 0.5;
  const garageD = houseL * 0.42;
  const driveGx = -houseW / 2 - garageW / 2 - 0.02;
  const garageFrontZ = (houseL / 2 - garageD / 2 - houseL * 0.04) + garageD / 2;
  const driveDepth = Math.max(0.6, l / 2 - garageFrontZ);
  const driveMat = new THREE.MeshStandardMaterial({ color: 0x555a5e, roughness: 0.95 });
  const driveway = new THREE.Mesh(new THREE.PlaneGeometry(garageW * 0.65, driveDepth), driveMat);
  driveway.rotation.x = -Math.PI / 2;
  driveway.position.set(driveGx, 0.008, l / 2 - driveDepth / 2);
  driveway.receiveShadow = true;
  groundGroup.add(driveway);

  groundGroup.add(makeFence(w, l));

  scene.add(groundGroup);
}

function makeFence(w, l) {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.8 });
  const postH = 0.22;
  const spacing = Math.max(0.35, Math.min(w, l) / 14);
  const corners = [
    { x0: -w / 2, z0: -l / 2, x1: w / 2, z1: -l / 2 },
    { x0: w / 2, z0: -l / 2, x1: w / 2, z1: l / 2 },
    { x0: -w / 2, z0: l / 2, x1: w / 2, z1: l / 2 },
    { x0: -w / 2, z0: -l / 2, x1: -w / 2, z1: l / 2 },
  ];
  corners.forEach(({ x0, z0, x1, z1 }) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const count = Math.max(2, Math.round(len / spacing));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, postH, 6), postMat);
      post.position.set(x0 + (x1 - x0) * t, postH / 2, z0 + (z1 - z0) * t);
      group.add(post);
    }
    const railLen = len;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(x0 === x1 ? 0.03 : railLen, 0.03, x0 === x1 ? railLen : 0.03), postMat);
    rail.position.set((x0 + x1) / 2, postH * 0.75, (z0 + z1) / 2);
    group.add(rail);
  });
  return group;
}

function makeTree(x, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x5c4530, roughness: 0.9 }));
  trunk.position.y = 0.25; trunk.castShadow = true;
  group.add(trunk);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.85 }));
  canopy.position.y = 0.62; canopy.scale.y = 1.1; canopy.castShadow = true;
  group.add(canopy);
  group.position.set(x, 0, z);
  return group;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose()); else obj.material.dispose(); }
  });
}

/* ------------------------------------------------------------------ */
/* Room labels                                                          */
/* ------------------------------------------------------------------ */

function makeRoomLabel(text) {
  const fontSize = 56, padding = 22;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  const textWidth = ctx.measureText(text.toUpperCase()).width;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + padding * 1.6;
  ctx.font = `600 ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = "rgba(15, 25, 35, 0.78)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f0d878";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  const aspect = canvas.width / canvas.height, height = 0.2;
  sprite.scale.set(height * aspect, height, 1);
  return sprite;
}

/* ------------------------------------------------------------------ */
/* Furniture + fixtures                                                 */
/* ------------------------------------------------------------------ */

function makeFurniturePiece(name, qW, qD, wallHeight, trimMat, accentColor) {
  const group = new THREE.Group();
  const n = name.toLowerCase();
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.65 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.25 });

  if (n.includes("toilet")) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(qW * 0.09, qW * 0.11, wallHeight * 0.13, 12), porcelainMat);
    bowl.position.y = wallHeight * 0.065; group.add(bowl);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.22, wallHeight * 0.22, qD * 0.1), porcelainMat);
    tank.position.set(0, wallHeight * 0.13 + wallHeight * 0.11, -qD * 0.28); group.add(tank);
  } else if (n.includes("sink") || n.includes("vanity")) {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.45, wallHeight * 0.04, qD * 0.26), porcelainMat);
    counter.position.y = wallHeight * 0.28; group.add(counter);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.42, wallHeight * 0.26, qD * 0.24), trimMat);
    cab.position.y = wallHeight * 0.14; group.add(cab);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(qW * 0.09, qW * 0.08, wallHeight * 0.03, 14), porcelainMat);
    basin.position.y = wallHeight * 0.3; group.add(basin);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.32, wallHeight * 0.24, 0.02), new THREE.MeshStandardMaterial({ color: 0xbcd6e0, roughness: 0.05, metalness: 0.35 }));
    mirror.position.set(0, wallHeight * 0.58, -qD * 0.12); group.add(mirror);
  } else if (n.includes("shower") || n.includes("tub") || n.includes("bath")) {
    const basin = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.4, wallHeight * 0.12, qD * 0.5), porcelainMat);
    basin.position.y = wallHeight * 0.06; group.add(basin);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.42, wallHeight * 0.55, 0.02), new THREE.MeshStandardMaterial({ color: 0xbfe0ee, roughness: 0.1, transparent: true, opacity: 0.35 }));
    glass.position.set(0, wallHeight * 0.33, qD * 0.24); group.add(glass);
  } else if (n.includes("sofa") || n.includes("sectional") || n.includes("bench") || n.includes("armchair") || n.includes("chair")) {
    const seatW = qW * 0.55, seatD = qD * 0.34, seatH = wallHeight * 0.15;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(seatW, seatH, seatD), accentMat);
    seat.position.y = seatH / 2; group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(seatW, seatH * 1.5, seatD * 0.16), accentMat);
    back.position.set(0, seatH + (seatH * 1.5) * 0.4, -seatD / 2 + seatD * 0.08); group.add(back);
    [-1, 0, 1].forEach((cx) => {
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(seatW * 0.26, seatH * 0.5, seatD * 0.5), cushionMat);
      cushion.position.set(cx * seatW * 0.3, seatH + seatH * 0.25, seatD * 0.05); group.add(cushion);
    });
  } else if (n.includes("desk")) {
    const topW = qW * 0.42, topD = qD * 0.26, topH = wallHeight * 0.025, legH = wallHeight * 0.15;
    const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topD), accentMat);
    top.position.y = legH + topH / 2; group.add(top);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.3, legH * 0.6, topD * 0.9), trimMat);
    drawer.position.set(topW * 0.3, legH * 0.3, 0); group.add(drawer);
  } else if (n.includes("table")) {
    const topW = qW * 0.5, topD = qD * 0.4, topH = wallHeight * 0.03, legH = wallHeight * 0.16;
    const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topD), accentMat);
    top.position.y = legH + topH / 2; group.add(top);
    const legGeo = new THREE.CylinderGeometry(topW * 0.02, topW * 0.02, legH, 8);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, trimMat);
      leg.position.set(sx * topW * 0.42, legH / 2, sz * topD * 0.38); group.add(leg);
    });
    [-1, 1].forEach((sz) => {
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.22, legH * 0.55, topD * 0.22), trimMat);
      chairSeat.position.set(0, (legH * 0.55) / 2, sz * (topD / 2 + topD * 0.22)); group.add(chairSeat);
      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.22, legH * 0.9, topD * 0.04), trimMat);
      chairBack.position.set(0, legH * 0.55 + legH * 0.45, sz * (topD / 2 + topD * 0.22 * 1.75)); group.add(chairBack);
    });
  } else if (n.includes("bed")) {
    const bedW = qW * 0.55, bedD = qD * 0.55, bedH = wallHeight * 0.14;
    const base = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, bedD), accentMat);
    base.position.y = bedH / 2; group.add(base);
    const head = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallHeight * 0.32, bedD * 0.06), trimMat);
    head.position.set(0, bedH + wallHeight * 0.16, -bedD / 2); group.add(head);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(bedW * 0.6, bedH * 0.35, bedD * 0.16), cushionMat);
    pillow.position.set(0, bedH + bedH * 0.2, -bedD / 2 + bedD * 0.14); group.add(pillow);
  } else if (n.includes("cabinet") || n.includes("shelv") || n.includes("bookcase") || n.includes("storage") || n.includes("counter") || n.includes("island")) {
    const w = qW * 0.5, d = qD * 0.16, h = wallHeight * 0.55;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
    cab.position.y = h / 2; group.add(cab);
    const shelfMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });
    [0.35, 0.65].forEach((t) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 0.02, d * 1.01), shelfMat);
      shelf.position.y = h * t; group.add(shelf);
    });
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.3, wallHeight * 0.18, qD * 0.3), accentMat);
    box.position.y = wallHeight * 0.09; group.add(box);
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

function floorColorForRoom(room) {
  const r = room.toLowerCase();
  if (r.includes("kitchen") || r.includes("dining")) return 0xd9d2c2;
  if (r.includes("wash") || r.includes("bath")) return 0xcdd8dc;
  if (r.includes("bedroom")) return 0xb98a5e;
  if (r.includes("mudroom") || r.includes("porch")) return 0x8a6b47;
  if (r.includes("study") || r.includes("office") || r.includes("utility")) return 0x9c7b52;
  return 0xa9784f;
}

/* ------------------------------------------------------------------ */
/* Staircase (connects ground + upper floor, placed in the Lounge)     */
/* ------------------------------------------------------------------ */

function buildStaircase(group, x, z, cellW, cellD, wallHeight, trimMat) {
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.7 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5 });
  const steps = 12;
  const runDepth = cellD * 0.5;
  const stepD = runDepth / steps;
  const stepH = (wallHeight * 2) / steps;
  const stairW = cellW * 0.32;
  const startZ = z - runDepth / 2;
  const startX = x + cellW * 0.28;

  for (let i = 0; i < steps; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(stairW, stepH * 0.4, stepD), stairMat);
    step.position.set(startX, i * stepH + stepH * 0.2, startZ + i * stepD);
    step.castShadow = true; step.receiveShadow = true;
    group.add(step);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, wallHeight * 1.9, 0.025), railMat);
  for (let i = 0; i < 3; i++) {
    const post = rail.clone();
    const t = i / 2;
    post.position.set(startX + stairW / 2 + 0.02, (wallHeight * 1.9) / 2, startZ + t * runDepth);
    group.add(post);
  }
}

/* ------------------------------------------------------------------ */
/* Garage (attached, ground level only)                                 */
/* ------------------------------------------------------------------ */

function buildGarage(group, houseW, houseL, wallHeight, style, trimMat, doorway, obstaclesOut) {
  const garageW = houseW * 0.5;
  const garageD = houseL * 0.42;
  const garageH = wallHeight * 0.92;
  const gx = -houseW / 2 - garageW / 2 - 0.02;
  const gz = houseL / 2 - garageD / 2 - houseL * 0.04;
  const wallT = 0.06;

  const wallMat = new THREE.MeshStandardMaterial({ color: style.wallColor, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: style.roofColor, roughness: 0.55 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.55, metalness: 0.15 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(garageW, garageH, wallT), wallMat);
  back.position.set(gx, garageH / 2, gz - garageD / 2 + wallT / 2);
  back.castShadow = true; back.receiveShadow = true;
  group.add(back);
  obstaclesOut.push({ minX: gx - garageW / 2, maxX: gx + garageW / 2, minZ: gz - garageD / 2, maxZ: gz - garageD / 2 + wallT });

  const side1 = new THREE.Mesh(new THREE.BoxGeometry(wallT, garageH, garageD), wallMat);
  side1.position.set(gx - garageW / 2 + wallT / 2, garageH / 2, gz);
  side1.castShadow = true; side1.receiveShadow = true;
  group.add(side1);
  obstaclesOut.push({ minX: gx - garageW / 2, maxX: gx - garageW / 2 + wallT, minZ: gz - garageD / 2, maxZ: gz + garageD / 2 });

  // side2 faces the house — carve a connecting doorway into it where it overlaps
  // the house's mudroom/utility room opening, so the garage is walkable from inside.
  const sideX = gx + garageW / 2 - wallT / 2;
  const gStart = Math.max(gz - garageD / 2, doorway.z0);
  const gEnd = Math.min(gz + garageD / 2, doorway.z1);
  if (gEnd - gStart > 0.15) {
    const pieceALen = gStart - (gz - garageD / 2);
    const pieceBLen = (gz + garageD / 2) - gEnd;
    if (pieceALen > 0.05) {
      const pieceA = new THREE.Mesh(new THREE.BoxGeometry(wallT, garageH, pieceALen), wallMat);
      pieceA.position.set(sideX, garageH / 2, (gz - garageD / 2) + pieceALen / 2);
      group.add(pieceA);
      obstaclesOut.push({ minX: sideX - wallT / 2, maxX: sideX + wallT / 2, minZ: gz - garageD / 2, maxZ: gz - garageD / 2 + pieceALen });
    }
    if (pieceBLen > 0.05) {
      const pieceB = new THREE.Mesh(new THREE.BoxGeometry(wallT, garageH, pieceBLen), wallMat);
      pieceB.position.set(sideX, garageH / 2, (gz + garageD / 2) - pieceBLen / 2);
      group.add(pieceB);
      obstaclesOut.push({ minX: sideX - wallT / 2, maxX: sideX + wallT / 2, minZ: gz + garageD / 2 - pieceBLen, maxZ: gz + garageD / 2 });
    }
  } else {
    const side2 = new THREE.Mesh(new THREE.BoxGeometry(wallT, garageH, garageD), wallMat);
    side2.position.set(sideX, garageH / 2, gz);
    group.add(side2);
    obstaclesOut.push({ minX: sideX - wallT / 2, maxX: sideX + wallT / 2, minZ: gz - garageD / 2, maxZ: gz + garageD / 2 });
  }

  const floor = new THREE.Mesh(new THREE.BoxGeometry(garageW - wallT, 0.05, garageD - wallT), new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.9 }));
  floor.position.set(gx, 0.025, gz);
  floor.receiveShadow = true;
  group.add(floor);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(garageW * 1.08, garageH * 0.05, garageD * 1.08), roofMat);
  roof.position.set(gx, garageH + garageH * 0.025, gz);
  roof.castShadow = true;
  group.add(roof);

  // garage door (front face, with horizontal panel grooves) — left open, so it
  // also works as a second entrance for the walkthrough
  const doorW = garageW * 0.82;
  const doorH = garageH * 0.82;
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.05), doorMat);
  door.position.set(gx, doorH / 2, gz + garageD / 2 - 0.02);
  group.add(door);
  for (let i = 1; i < 5; i++) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.98, 0.015, 0.052), new THREE.MeshStandardMaterial({ color: 0x9a9da1, roughness: 0.5 }));
    groove.position.set(gx, (doorH / 5) * i, gz + garageD / 2 - 0.018);
    group.add(groove);
  }

  // simple car placeholder
  const carMat = new THREE.MeshStandardMaterial({ color: 0x8a2e2e, roughness: 0.35, metalness: 0.2 });
  const bodyW = garageW * 0.42, bodyH = garageH * 0.22, bodyD = garageD * 0.55;
  const carBody = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), carMat);
  carBody.position.set(gx, bodyH / 2 + 0.05, gz - garageD * 0.05);
  carBody.castShadow = true;
  group.add(carBody);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.75, bodyH * 0.8, bodyD * 0.45), carMat);
  cabin.position.set(gx, bodyH + bodyH * 0.4 + 0.05, gz - garageD * 0.05);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(bodyH * 0.32, bodyH * 0.32, 0.05, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gx + sx * bodyW * 0.42, bodyH * 0.32, gz - garageD * 0.05 + sz * bodyD * 0.32);
    group.add(wheel);
  });

  // storage shelving along the back wall
  const shelf = makeFurniturePiece("Wall storage shelving", garageW * 0.5, garageD * 0.3, garageH, trimMat, style.accent);
  shelf.position.set(gx + garageW * 0.22, 0, gz - garageD / 2 + garageD * 0.12);
  group.add(shelf);

  return { minX: gx - garageW / 2, maxX: gx + garageW / 2, minZ: gz - garageD / 2, maxZ: gz + garageD / 2 };
}

/* ------------------------------------------------------------------ */
/* One floor level: walls, rooms, furniture, front wall (toggleable)   */
/* ------------------------------------------------------------------ */

function addWallSegment(orientation, fixed, start, end, gap, thickness, height, yBase, mat, group, obstacles) {
  const totalLen = end - start;
  const segLen = Math.max(0.03, (totalLen - gap) / 2);
  [start + segLen / 2, end - segLen / 2].forEach((centerCoord) => {
    let geo, x, z, minX, maxX, minZ, maxZ;
    if (orientation === "vertical") {
      geo = new THREE.BoxGeometry(thickness, height, segLen);
      x = fixed; z = centerCoord;
      minX = x - thickness / 2; maxX = x + thickness / 2;
      minZ = z - segLen / 2; maxZ = z + segLen / 2;
    } else {
      geo = new THREE.BoxGeometry(segLen, height, thickness);
      x = centerCoord; z = fixed;
      minX = x - segLen / 2; maxX = x + segLen / 2;
      minZ = z - thickness / 2; maxZ = z + thickness / 2;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, yBase + height / 2, z);
    mesh.castShadow = true;
    group.add(mesh);
    if (obstacles) obstacles.push({ minX, maxX, minZ, maxZ });
  });
}

function buildLevel(opts) {
  const { group, yBase, wallHeight, wallThickness, houseW, houseL, cellCenters, cellW, cellD, style, mats, collectObstacles, obstaclesOut, includeDoor, garageDoorway } = opts;
  const { wallMat, trimMat, interiorWallMat, ceilingMat, glassMat } = mats;
  const obstacles = collectObstacles ? obstaclesOut : null;

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallHeight, wallThickness), wallMat);
  backWall.position.set(0, yBase + wallHeight / 2, -houseL / 2 + wallThickness / 2);
  backWall.castShadow = true; backWall.receiveShadow = true;
  group.add(backWall);
  if (obstacles) obstacles.push({ minX: -houseW / 2, maxX: houseW / 2, minZ: -houseL / 2, maxZ: -houseL / 2 + wallThickness });

  if (garageDoorway) {
    // split the left wall so the mudroom/utility room opens straight into the garage
    const gapStart = garageDoorway.z0, gapEnd = garageDoorway.z1;
    const pieceALen = gapStart - (-houseL / 2);
    const pieceBLen = houseL / 2 - gapEnd;
    if (pieceALen > 0.05) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, pieceALen), wallMat);
      a.position.set(-houseW / 2 + wallThickness / 2, yBase + wallHeight / 2, -houseL / 2 + pieceALen / 2);
      a.castShadow = true; a.receiveShadow = true;
      group.add(a);
      if (obstacles) obstacles.push({ minX: -houseW / 2, maxX: -houseW / 2 + wallThickness, minZ: -houseL / 2, maxZ: -houseL / 2 + pieceALen });
    }
    if (pieceBLen > 0.05) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, pieceBLen), wallMat);
      b.position.set(-houseW / 2 + wallThickness / 2, yBase + wallHeight / 2, houseL / 2 - pieceBLen / 2);
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      if (obstacles) obstacles.push({ minX: -houseW / 2, maxX: -houseW / 2 + wallThickness, minZ: houseL / 2 - pieceBLen, maxZ: houseL / 2 });
    }
  } else {
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, houseL), wallMat);
    leftWall.position.set(-houseW / 2 + wallThickness / 2, yBase + wallHeight / 2, 0);
    leftWall.castShadow = true; leftWall.receiveShadow = true;
    group.add(leftWall);
    if (obstacles) obstacles.push({ minX: -houseW / 2, maxX: -houseW / 2 + wallThickness, minZ: -houseL / 2, maxZ: houseL / 2 });
  }

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, houseL), wallMat);
  rightWall.position.set(houseW / 2 - wallThickness / 2, yBase + wallHeight / 2, 0);
  rightWall.castShadow = true; rightWall.receiveShadow = true;
  group.add(rightWall);
  if (obstacles) obstacles.push({ minX: houseW / 2 - wallThickness, maxX: houseW / 2, minZ: -houseL / 2, maxZ: houseL / 2 });

  const innerW = houseW - wallThickness * 2;
  const innerD = houseL - wallThickness * 2;
  const partitionHeight = wallHeight * 0.92;
  const gap = Math.max(0.4, Math.min(cellW, cellD) * 0.34);

  [-innerW / 2 + cellW, -innerW / 2 + cellW * 2].forEach((xPos) => {
    for (let r = 0; r < 2; r++) {
      const zStart = -innerD / 2 + cellD * r;
      addWallSegment("vertical", xPos, zStart, zStart + cellD, gap, wallThickness * 0.7, partitionHeight, yBase, interiorWallMat, group, obstacles);
    }
  });
  [-innerD / 2 + cellD].forEach((zPos) => {
    for (let c = 0; c < 3; c++) {
      const xStart = -innerW / 2 + cellW * c;
      addWallSegment("horizontal", zPos, xStart, xStart + cellW, gap, wallThickness * 0.7, partitionHeight, yBase, interiorWallMat, group, obstacles);
    }
  });

  style.rooms.forEach((roomDef, idx) => {
    const center = cellCenters[idx];
    const floorMat = floorMaterialForRoom(floorColorForRoom(roomDef.room), cellW / FT, cellD / FT);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(cellW - 0.01, 0.05, cellD - 0.01), floorMat);
    floor.position.set(center.x, yBase + 0.025, center.z);
    floor.receiveShadow = true;
    group.add(floor);
  });

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(houseW - wallThickness, 0.04, houseL - wallThickness), ceilingMat);
  ceiling.position.y = yBase + wallHeight - 0.02;
  group.add(ceiling);

  style.rooms.forEach((roomDef, idx) => {
    const center = cellCenters[idx];
    const lamp = new THREE.PointLight(0xffddaa, 0.45, Math.max(cellW, cellD) * 3, 2);
    lamp.position.set(center.x, yBase + wallHeight * 0.85, center.z);
    group.add(lamp);

    const label = makeRoomLabel(roomDef.room);
    label.position.set(center.x, yBase + wallHeight * 0.82, center.z);
    group.add(label);

    const items = roomDef.items;
    items.forEach((item, j) => {
      const spread = (j - (items.length - 1) / 2) * (cellD * 0.4);
      const piece = makeFurniturePiece(item, cellW, cellD, wallHeight, trimMat, style.accent);
      piece.position.set(center.x, yBase, center.z + spread);
      group.add(piece);
    });
  });

  if (style.glassBand) {
    const bandH = wallHeight * 0.32;
    const band = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.002, bandH, houseL * 1.002), glassMat);
    band.position.y = yBase + wallHeight * 0.62;
    group.add(band);
  }

  const frontGroup = new THREE.Group();
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallHeight, wallThickness), wallMat);
  frontWall.position.set(0, yBase + wallHeight / 2, houseL / 2 - wallThickness / 2);
  frontWall.castShadow = true; frontWall.receiveShadow = true;
  frontGroup.add(frontWall);

  if (includeDoor) {
    const doorW = houseW * 0.09, doorH = wallHeight * 0.55;
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.22, doorH * 1.08, 0.05), trimMat);
    doorFrame.position.set(0, yBase + (doorH * 1.08) / 2, houseL / 2 + 0.018);
    frontGroup.add(doorFrame);
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.045), new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.5 }));
    door.position.set(0, yBase + doorH / 2, houseL / 2 + 0.03);
    frontGroup.add(door);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(doorW * 0.06, 8, 8), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.3 }));
    handle.position.set(doorW * 0.32, yBase + doorH * 0.5, houseL / 2 + 0.06);
    frontGroup.add(handle);
    const step = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.8, 0.08, 0.32), trimMat);
    step.position.set(0, 0.04, houseL / 2 + 0.2);
    frontGroup.add(step);
  } else {
    // upper floor: a balcony-height railing instead of a ground door
    const railing = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.3, wallHeight * 0.05, 0.04), trimMat);
    railing.position.set(0, yBase + wallHeight * 0.3, houseL / 2 + 0.018);
    frontGroup.add(railing);
  }

  if (!style.glassBand) {
    const winCount = 3, winW = houseW * 0.075, winH = wallHeight * 0.3, winY = yBase + wallHeight * 0.55;
    for (let i = 0; i < winCount; i++) {
      const t = (i + 1) / (winCount + 1);
      const x = -houseW / 2 + t * houseW;
      if (Math.abs(x) < houseW * 0.07) continue;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(winW * 1.18, winH * 1.14, 0.04), trimMat);
      frame.position.set(x, winY, houseL / 2 + 0.018);
      frontGroup.add(frame);
      const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.03), glassMat);
      win.position.set(x, winY, houseL / 2 + 0.03);
      frontGroup.add(win);
      const mullionV = new THREE.Mesh(new THREE.BoxGeometry(winW * 0.05, winH, 0.032), trimMat);
      mullionV.position.set(x, winY, houseL / 2 + 0.031);
      frontGroup.add(mullionV);
      const mullionH = new THREE.Mesh(new THREE.BoxGeometry(winW, winH * 0.05, 0.032), trimMat);
      mullionH.position.set(x, winY, houseL / 2 + 0.031);
      frontGroup.add(mullionH);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(winW * 1.3, wallHeight * 0.025, 0.07), trimMat);
      sill.position.set(x, winY - winH / 2 - wallHeight * 0.015, houseL / 2 + 0.04);
      frontGroup.add(sill);
    }
  }

  group.add(frontGroup);
  return frontGroup;
}

/* ------------------------------------------------------------------ */
/* Full house: two levels + roof + garage                              */
/* ------------------------------------------------------------------ */

function buildHouse(widthFt, lengthFt, styleKey) {
  if (houseGroup) { scene.remove(houseGroup); disposeGroup(houseGroup); }

  const style = STYLES[styleKey];
  const group = new THREE.Group();

  const plotW = widthFt * FT;
  const plotL = lengthFt * FT;
  const houseW = plotW * 0.62;
  const houseL = plotL * 0.55;
  const wallHeight = 2.3 + Math.min(plotW, plotL) * 0.02;
  const wallThickness = Math.max(0.05, Math.min(houseW, houseL) * 0.025);

  const mats = {
    wallMat: wallMaterialForStyle(styleKey, style.wallColor),
    trimMat: new THREE.MeshStandardMaterial({ color: style.trimColor, roughness: 0.6 }),
    interiorWallMat: new THREE.MeshStandardMaterial({ color: 0xe4ded0, roughness: 0.92 }),
    ceilingMat: new THREE.MeshStandardMaterial({ color: 0xf2efe7, roughness: 0.95, side: THREE.DoubleSide }),
    glassMat: new THREE.MeshStandardMaterial({ color: 0x9fc4d6, roughness: 0.1, metalness: 0.05, emissive: 0x24343c, emissiveIntensity: 0.25 }),
  };
  const roofMat = new THREE.MeshStandardMaterial({ color: style.roofColor, roughness: 0.55 });

  const cols = 3, rows = 2;
  const innerW = houseW - wallThickness * 2;
  const innerD = houseL - wallThickness * 2;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const cellCenters = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cellCenters.push({ x: -innerW / 2 + cellW * (c + 0.5), z: -innerD / 2 + cellD * (r + 0.5) });
  }

  const wallObstacles = [];

  // doorway connecting the front-left room (index 3: Mudroom/Utility/Study/Home
  // Office) straight through to the garage, so the garage is reachable on foot
  const gapSize = Math.max(0.4, Math.min(cellW, cellD) * 0.34);
  const frontLeftZStart = -innerD / 2 + cellD; // row 1 (front row) start
  const frontLeftZEnd = innerD / 2;
  const doorCenterZ = (frontLeftZStart + frontLeftZEnd) / 2;
  const garageDoorway = { z0: doorCenterZ - gapSize / 2, z1: doorCenterZ + gapSize / 2 };

  const frontGroupGround = buildLevel({
    group, yBase: 0, wallHeight, wallThickness, houseW, houseL, cellCenters, cellW, cellD, style, mats,
    collectObstacles: true, obstaclesOut: wallObstacles, includeDoor: true, garageDoorway,
  });
  const frontGroupUpper = buildLevel({
    group, yBase: wallHeight, wallHeight, wallThickness, houseW, houseL, cellCenters, cellW, cellD, style, mats,
    collectObstacles: false, obstaclesOut: null, includeDoor: false, garageDoorway: null,
  });

  // staircase, in the Lounge cell (index 4), connecting both levels
  const loungeCenter = cellCenters[4];
  buildStaircase(group, loungeCenter.x, loungeCenter.z, cellW, cellD, wallHeight, mats.trimMat);

  // roof sits on top of the SECOND floor now
  const topY = wallHeight * 2;
  if (style.roofStyle === "flat") {
    const overhang = 1.12;
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(houseW * overhang, wallHeight * 0.05, houseL * overhang), mats.trimMat);
    fascia.position.y = topY + wallHeight * 0.025;
    group.add(fascia);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(houseW * (overhang - 0.02), wallHeight * 0.05, houseL * (overhang - 0.02)), roofMat);
    roof.position.y = topY + wallHeight * 0.075;
    roof.castShadow = true;
    group.add(roof);
  } else {
    const pitch = style.roofStyle === "gable-steep" ? 1.05 : 0.7;
    const roofHeight = (houseW / 2) * pitch;
    const overhang = houseW * 0.07;
    const depth = houseL + overhang * 2;
    const shape = new THREE.Shape();
    shape.moveTo(-houseW / 2 - overhang, 0);
    shape.lineTo(houseW / 2 + overhang, 0);
    shape.lineTo(0, roofHeight);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -depth / 2);
    const roofMesh = new THREE.Mesh(geo, roofMat);
    roofMesh.position.y = topY;
    roofMesh.castShadow = true; roofMesh.receiveShadow = true;
    group.add(roofMesh);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.045, houseW * 0.045, depth), mats.trimMat);
    ridge.position.set(0, topY + roofHeight, 0);
    group.add(ridge);
  }

  const base = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.02, 0.14, houseL * 1.02), mats.trimMat);
  base.position.y = 0.07;
  group.add(base);

  if (style.columns) {
    const colH = wallHeight * 0.62;
    const colGeo = new THREE.CylinderGeometry(houseW * 0.02, houseW * 0.02, colH, 12);
    [-1, 1].forEach((side) => {
      const col = new THREE.Mesh(colGeo, mats.trimMat);
      col.position.set(side * houseW * 0.16, colH / 2, houseL / 2 + 0.35);
      col.castShadow = true;
      group.add(col);
    });
    const pediment = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.42, 0.1, 0.5), mats.trimMat);
    pediment.position.set(0, colH + 0.05, houseL / 2 + 0.35);
    group.add(pediment);
  }

  if (style.porch) {
    const porchDepth = houseL * 0.2;
    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.02, 0.08, porchDepth), mats.trimMat);
    porchFloor.position.set(0, 0.04, houseL / 2 + porchDepth / 2);
    group.add(porchFloor);
    const roofOverhang = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.05, 0.06, porchDepth + 0.1), roofMat);
    roofOverhang.position.set(0, wallHeight * 0.72, houseL / 2 + porchDepth / 2);
    group.add(roofOverhang);
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, wallHeight * 0.72, 8);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const post = new THREE.Mesh(postGeo, mats.trimMat);
      post.position.set(-houseW / 2 + t * houseW, (wallHeight * 0.72) / 2, houseL / 2 + porchDepth - 0.1);
      group.add(post);
    }
  }

  const garageBounds = buildGarage(group, houseW, houseL, wallHeight, style, mats.trimMat, garageDoorway, wallObstacles);

  scene.add(group);
  houseGroup = group;
  group.userData.span = Math.max(plotW, plotL) + houseW * 0.55; // include garage in framing
  group.userData.wallHeight = wallHeight;
  group.userData.houseW = houseW;
  group.userData.houseL = houseL;
  group.userData.eyeHeightGround = wallHeight * 0.45;
  group.userData.eyeHeightUpper = wallHeight + wallHeight * 0.45;
  group.userData.wallObstacles = wallObstacles;
  group.userData.frontGroups = [frontGroupGround, frontGroupUpper];
  // walkable zones for the walkthrough: the house footprint, and — ground level
  // only — the garage footprint, connected through the doorway obstacles above
  // already carve out.
  group.userData.walkZones = [
    { minX: -houseW / 2, maxX: houseW / 2, minZ: -houseL / 2, maxZ: houseL / 2, groundOnly: false },
    { ...garageBounds, groundOnly: true },
  ];

  fitCameraToObject(group.userData.span);
}

function setFrontGroupsVisible(visible) {
  if (!houseGroup) return;
  houseGroup.userData.frontGroups.forEach((fg) => { fg.visible = visible; });
}

function fitCameraToObject(span, animated = false) {
  const dist = Math.max(7, span * 0.85);
  const angle = Math.PI / 4.4;
  const pos = new THREE.Vector3(Math.cos(angle) * dist, dist * 0.55, Math.sin(angle) * dist);
  const target = new THREE.Vector3(0, 1.4, 0);
  if (animated) tweenCamera(pos, target);
  else { camera.position.copy(pos); controls.target.copy(target); controls.update(); }
}

function fitCameraInterior(span, wallHeight, animated = false) {
  const pos = new THREE.Vector3(0, wallHeight * 1.5, span * 0.8);
  const target = new THREE.Vector3(0, wallHeight * 0.8, 0);
  if (animated) tweenCamera(pos, target);
  else { camera.position.copy(pos); controls.target.copy(target); controls.update(); }
}

/* ------------------------------------------------------------------ */
/* UI wiring                                                            */
/* ------------------------------------------------------------------ */

const form = document.getElementById("plotForm");
const recBox = document.getElementById("recommendation");
const recStyleEl = document.getElementById("recStyle");
const recReasonEl = document.getElementById("recReason");
const styleGrid = document.getElementById("styleGrid");
const furnitureBody = document.getElementById("furnitureBody");
const interiorToggleBtn = document.getElementById("interiorToggleBtn");
const walkToggleBtn = document.getElementById("walkToggleBtn");
let interiorMode = false;

function setInteriorMode(on, animated = true) {
  interiorMode = on;
  if (!houseGroup) return;
  setFrontGroupsVisible(!on);
  interiorToggleBtn.textContent = on ? "Show exterior" : "Show interior";
  interiorToggleBtn.classList.toggle("active", on);
  const span = houseGroup.userData.span;
  const wallHeight = houseGroup.userData.wallHeight;
  if (on) fitCameraInterior(span, wallHeight, animated);
  else fitCameraToObject(span, animated);
}

interiorToggleBtn.addEventListener("click", () => setInteriorMode(!interiorMode));

function enterWalkthrough() {
  if (!houseGroup) return;
  interiorMode = false;
  walkActive = true;
  walkLevel = 0;
  controls.enabled = false;
  setFrontGroupsVisible(false);
  camera.position.set(0, houseGroup.userData.eyeHeightGround, houseGroup.userData.houseL / 2 - 0.3);
  camera.lookAt(0, houseGroup.userData.eyeHeightGround, 0);
  walkOverlay.classList.add("show");
  walkOverlay.onclick = () => walkControls.lock();
  walkToggleBtn.classList.add("active");
  walkToggleBtn.textContent = "Exit walkthrough";
  interiorToggleBtn.style.display = "none";
}

function exitWalkthrough() {
  if (!walkActive) return;
  walkActive = false;
  if (walkControls && walkControls.isLocked) walkControls.unlock();
  walkOverlay.classList.remove("show");
  walkExitHint.classList.remove("show");
  controls.enabled = true;
  walkToggleBtn.classList.remove("active");
  walkToggleBtn.textContent = "Walk through";
  interiorToggleBtn.style.display = "block";
  if (houseGroup) {
    setFrontGroupsVisible(!interiorMode);
    fitCameraToObject(houseGroup.userData.span, false);
  }
}

walkToggleBtn.addEventListener("click", () => (walkActive ? exitWalkthrough() : enterWalkthrough()));

function renderFurniture(styleKey) {
  const items = flattenRooms(STYLES[styleKey]);
  furnitureBody.innerHTML = "";
  items.forEach((item, idx) => {
    const tr = document.createElement("tr");
    const num = String(idx + 1).padStart(2, "0");
    tr.innerHTML = `<td class="item-num">${num}</td><td class="item-room">${item[0]}</td><td>${item[1]}</td>`;
    furnitureBody.appendChild(tr);
  });
}

function setActiveCard(styleKey) {
  [...styleGrid.children].forEach((card) => card.classList.toggle("active", card.dataset.style === styleKey));
}

function applyStyle(styleKey, { rebuildHouse = true } = {}) {
  currentStyleKey = styleKey;
  setActiveCard(styleKey);
  renderFurniture(styleKey);
  if (rebuildHouse && houseGroup) {
    buildHouse(currentPlot.w, currentPlot.l, styleKey);
    setFrontGroupsVisible(!interiorMode);
    interiorToggleBtn.classList.toggle("active", interiorMode);
    interiorToggleBtn.textContent = interiorMode ? "Show exterior" : "Show interior";
    if (interiorMode) fitCameraInterior(houseGroup.userData.span, houseGroup.userData.wallHeight, false);
    updateTipsForCurrentPlot();
  }
}

function updateTipsForCurrentPlot() {
  const houseW = currentPlot.w * 0.62 * 0.9; // approximate net ft (matches scene-unit ratio)
  const houseL = currentPlot.l * 0.55 * 0.9;
  const cellWFt = houseW / 3;
  const cellDFt = houseL / 2;
  renderFurnitureTips(STYLES[currentStyleKey], cellWFt, cellDFt);
  renderCostEstimate(currentPlot.w, currentPlot.l, currentStyleKey);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const w = parseFloat(document.getElementById("plotWidth").value);
  const l = parseFloat(document.getElementById("plotLength").value);
  if (!w || !l || w <= 0 || l <= 0) return;

  currentPlot = { w, l };
  exitWalkthrough();

  initScene();
  emptyState.style.display = "none";
  canvasHint.style.display = "block";
  viewToggleGroup.style.display = "flex";

  const rec = recommendStyle(w, l);
  recStyleEl.textContent = STYLES[rec.key].label;
  recReasonEl.textContent = rec.reason;
  recBox.classList.add("show");

  buildGround(w, l);
  applyStyle(rec.key, { rebuildHouse: false });
  buildHouse(w, l, rec.key);
  setInteriorMode(false, false);
  updateTipsForCurrentPlot();

  currentFloorPlans = computeFloorPlan(w, l);
  activeFloorIdx = 0;
  renderFloorPlanUI();
});

styleGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".style-card");
  if (!card) return;
  applyStyle(card.dataset.style);
});

renderFurniture(currentStyleKey);
setActiveCard(currentStyleKey);

const tbDate = document.getElementById("tbDate");
if (tbDate) tbDate.textContent = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Grey-brick easter egg on background click                           */
/* ------------------------------------------------------------------ */

document.addEventListener("click", (e) => {
  const excluded = e.target.closest("form, .panel, .style-grid, .style-card, table, footer, header, button, input, a");
  if (excluded) return;

  const count = 4 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const brick = document.createElement("div");
    brick.className = "brick-pop";
    const dx = (Math.random() - 0.5) * 70;
    const delay = i * 40;
    brick.style.left = `${e.clientX}px`;
    brick.style.top = `${e.clientY}px`;
    brick.style.setProperty("--dx", `${dx}px`);
    brick.style.setProperty("--rot-start", `${(Math.random() - 0.5) * 20}deg`);
    brick.style.setProperty("--rot-mid", `${(Math.random() - 0.5) * 60}deg`);
    brick.style.setProperty("--rot-end", `${(Math.random() - 0.5) * 140}deg`);
    brick.style.animationDuration = `${0.9 + Math.random() * 0.3}s`;
    brick.style.animationDelay = `${delay}ms`;
    document.body.appendChild(brick);
    brick.addEventListener("animationend", () => brick.remove());
  }
});
