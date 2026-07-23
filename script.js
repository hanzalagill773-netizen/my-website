import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

/* ------------------------------------------------------------------ */
/* Style + room data                                                    */
/* Each style defines exactly 6 rooms, laid out on a fixed 3x2 grid:    */
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
    return {
      key: "minimalist",
      reason: `At ${area.toLocaleString()} sq ft, this plot rewards an efficient, compact footprint rather than deep massing. A minimalist cube form keeps every foot of the plot usable.`,
    };
  }
  if (ratio >= 2.1) {
    return {
      key: "farmhouse",
      reason: `The plot is long and narrow (about ${ratio.toFixed(1)}:1). A linear farmhouse plan with a wraparound porch reads well along the short frontage and makes use of the depth.`,
    };
  }
  if (area >= 3400 && ratio < 1.45) {
    return {
      key: "colonial",
      reason: `At ${area.toLocaleString()} sq ft on a near-square plot, there's enough width for a symmetric colonial layout with a formal, centered entry.`,
    };
  }
  return {
    key: "modern",
    reason: `A balanced plot of ${widthFt} × ${lengthFt} ft, without an extreme ratio or size, suits an open modern plan with flexible massing.`,
  };
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
  if (widthFt >= 16) {
    groundRows.push([{ name: "Parking", weight: 3.0, type: "parking" }]);
  }
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
    if (HATCH_TYPES.has(r.type)) {
      svg += `<rect x="${rx}" y="${ry}" width="${r.w}" height="${r.h}" fill="url(#hatch)" opacity="0.55"/>`;
    }
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
  floors.forEach((f) => f.rooms.forEach((r) => {
    if (r.type === "stair") return;
    counts[r.name] = (counts[r.name] || 0) + 1;
  }));
  const parts = Object.entries(counts).map(([name, n]) => `<strong>${n}</strong> ${name}${n > 1 ? "s" : ""}`);
  return `This plot fits: ${parts.join(" · ")}.`;
}

let currentFloorPlans = [];
let activeFloorIdx = 0;
const floorTabs = document.getElementById("floorTabs");
const floorPlanHost = document.getElementById("floorPlanHost");
const floorSummary = document.getElementById("floorSummary");

function renderFloorPlanUI() {
  floorTabs.innerHTML = "";
  currentFloorPlans.forEach((floor, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "floor-tab" + (idx === activeFloorIdx ? " active" : "");
    btn.textContent = floor.label;
    btn.addEventListener("click", () => {
      activeFloorIdx = idx;
      renderFloorPlanUI();
    });
    floorTabs.appendChild(btn);
  });
  const floor = currentFloorPlans[activeFloorIdx];
  floorPlanHost.innerHTML = floor ? svgForFloor(floor, currentPlot.w, currentPlot.l) : "";
  floorSummary.innerHTML = currentFloorPlans.length ? summarizeFloors(currentFloorPlans) : "";
}

/* ------------------------------------------------------------------ */
/* Scene setup                                                         */
/* ------------------------------------------------------------------ */

const FT = 0.09; // feet -> scene units

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

/* walkthrough state */
let walkControls = null;
let walkActive = false;
const walkKeys = { forward: false, backward: false, left: false, right: false };
const walkSpeed = 1.3;

function initScene() {
  if (initialized) return;
  initialized = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe0f2);
  scene.fog = new THREE.Fog(0xdcedf5, 20, 55);

  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 200);
  camera.position.set(9, 7, 11);

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
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 1, 0);

  const hemi = new THREE.HemisphereLight(0xdcedf7, 0x5c7a4a, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3d6, 1.4);
  sun.position.set(11, 15, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.0015;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xaecbe0, 0.35);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  const ambient = new THREE.AmbientLight(0x3a4a55, 0.35);
  scene.add(ambient);

  initWalkControls();

  window.addEventListener("resize", onResize);
  animate();
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
  if (walkActive) {
    updateWalkMovement(delta);
  } else {
    controls.update();
  }
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

/* ---- walkthrough movement + collision ---- */

function insideBounds(pos) {
  const ud = houseGroup.userData;
  const margin = 0.14;
  return Math.abs(pos.x) < ud.houseW / 2 - margin && Math.abs(pos.z) < ud.houseL / 2 - margin;
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

  camera.position.y = houseGroup.userData.eyeHeight;

  if (!insideBounds(camera.position) || collides(camera.position)) {
    camera.position.copy(prev);
    camera.position.y = houseGroup.userData.eyeHeight;
  }
}

document.addEventListener("keydown", (e) => {
  if (!walkActive) return;
  switch (e.code) {
    case "KeyW": case "ArrowUp": walkKeys.forward = true; break;
    case "KeyS": case "ArrowDown": walkKeys.backward = true; break;
    case "KeyA": case "ArrowLeft": walkKeys.left = true; break;
    case "KeyD": case "ArrowRight": walkKeys.right = true; break;
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
/* Ground, boundary + simple landscaping                               */
/* ------------------------------------------------------------------ */

function buildGround(widthFt, lengthFt) {
  if (groundGroup) {
    scene.remove(groundGroup);
    disposeGroup(groundGroup);
  }
  groundGroup = new THREE.Group();

  const w = widthFt * FT;
  const l = lengthFt * FT;
  const padW = w + 6;
  const padL = l + 6;

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5f8a4d, roughness: 1 });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(padW, padL), grassMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  groundGroup.add(groundMesh);

  const outlinePts = [
    new THREE.Vector3(-w / 2, 0.012, -l / 2),
    new THREE.Vector3(w / 2, 0.012, -l / 2),
    new THREE.Vector3(w / 2, 0.012, l / 2),
    new THREE.Vector3(-w / 2, 0.012, l / 2),
    new THREE.Vector3(-w / 2, 0.012, -l / 2),
  ];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePts),
    new THREE.LineDashedMaterial({ color: 0xc9a227, dashSize: 0.16, gapSize: 0.09 })
  );
  outline.computeLineDistances();
  groundGroup.add(outline);

  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    if (i > 1 && (w < 3 || l < 3)) return;
    const tx = sx * (w / 2 - 0.4);
    const tz = sz * (l / 2 - 0.4);
    if (Math.abs(tx) < w * 0.32 && Math.abs(tz) < l * 0.32) return;
    groundGroup.add(makeTree(tx, tz));
  });

  scene.add(groundGroup);
}

function makeTree(x, z) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4530, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.85 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6), trunkMat);
  trunk.position.y = 0.25;
  trunk.castShadow = true;
  group.add(trunk);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), leafMat);
  canopy.position.y = 0.62;
  canopy.scale.y = 1.1;
  canopy.castShadow = true;
  group.add(canopy);
  group.position.set(x, 0, z);
  return group;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Room labels                                                          */
/* ------------------------------------------------------------------ */

function makeRoomLabel(text) {
  const fontSize = 56;
  const padding = 22;
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
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  const aspect = canvas.width / canvas.height;
  const height = 0.2;
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
    bowl.position.y = wallHeight * 0.065;
    group.add(bowl);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.22, wallHeight * 0.22, qD * 0.1), porcelainMat);
    tank.position.set(0, wallHeight * 0.13 + wallHeight * 0.11, -qD * 0.28);
    group.add(tank);
  } else if (n.includes("sink") || n.includes("vanity")) {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.45, wallHeight * 0.04, qD * 0.26), porcelainMat);
    counter.position.y = wallHeight * 0.28;
    group.add(counter);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.42, wallHeight * 0.26, qD * 0.24), trimMat);
    cab.position.y = wallHeight * 0.14;
    group.add(cab);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(qW * 0.09, qW * 0.08, wallHeight * 0.03, 14), porcelainMat);
    basin.position.y = wallHeight * 0.3;
    group.add(basin);
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(qW * 0.32, wallHeight * 0.24, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xbcd6e0, roughness: 0.05, metalness: 0.35 })
    );
    mirror.position.set(0, wallHeight * 0.58, -qD * 0.12);
    group.add(mirror);
  } else if (n.includes("shower") || n.includes("tub") || n.includes("bath")) {
    const basin = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.4, wallHeight * 0.12, qD * 0.5), porcelainMat);
    basin.position.y = wallHeight * 0.06;
    group.add(basin);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(qW * 0.42, wallHeight * 0.55, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xbfe0ee, roughness: 0.1, transparent: true, opacity: 0.35 })
    );
    glass.position.set(0, wallHeight * 0.33, qD * 0.24);
    group.add(glass);
  } else if (n.includes("sofa") || n.includes("sectional") || n.includes("bench") || n.includes("armchair") || n.includes("chair")) {
    const seatW = qW * 0.55, seatD = qD * 0.34, seatH = wallHeight * 0.15;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(seatW, seatH, seatD), accentMat);
    seat.position.y = seatH / 2;
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(seatW, seatH * 1.5, seatD * 0.16), accentMat);
    back.position.set(0, seatH + (seatH * 1.5) * 0.4, -seatD / 2 + seatD * 0.08);
    group.add(back);
    [-1, 0, 1].forEach((cx) => {
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(seatW * 0.26, seatH * 0.5, seatD * 0.5), cushionMat);
      cushion.position.set(cx * seatW * 0.3, seatH + seatH * 0.25, seatD * 0.05);
      group.add(cushion);
    });
  } else if (n.includes("desk")) {
    const topW = qW * 0.42, topD = qD * 0.26, topH = wallHeight * 0.025, legH = wallHeight * 0.15;
    const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topD), accentMat);
    top.position.y = legH + topH / 2;
    group.add(top);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.3, legH * 0.6, topD * 0.9), trimMat);
    drawer.position.set(topW * 0.3, legH * 0.3, 0);
    group.add(drawer);
  } else if (n.includes("table")) {
    const topW = qW * 0.5, topD = qD * 0.4, topH = wallHeight * 0.03, legH = wallHeight * 0.16;
    const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topD), accentMat);
    top.position.y = legH + topH / 2;
    group.add(top);
    const legGeo = new THREE.CylinderGeometry(topW * 0.02, topW * 0.02, legH, 8);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, trimMat);
      leg.position.set(sx * topW * 0.42, legH / 2, sz * topD * 0.38);
      group.add(leg);
    });
    [-1, 1].forEach((sz) => {
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.22, legH * 0.55, topD * 0.22), trimMat);
      chairSeat.position.set(0, (legH * 0.55) / 2, sz * (topD / 2 + topD * 0.22));
      group.add(chairSeat);
      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.22, legH * 0.9, topD * 0.04), trimMat);
      chairBack.position.set(0, legH * 0.55 + legH * 0.45, sz * (topD / 2 + topD * 0.22 * 1.75));
      group.add(chairBack);
    });
  } else if (n.includes("bed")) {
    const bedW = qW * 0.55, bedD = qD * 0.55, bedH = wallHeight * 0.14;
    const base = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, bedD), accentMat);
    base.position.y = bedH / 2;
    group.add(base);
    const head = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallHeight * 0.32, bedD * 0.06), trimMat);
    head.position.set(0, bedH + wallHeight * 0.16, -bedD / 2);
    group.add(head);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(bedW * 0.6, bedH * 0.35, bedD * 0.16), cushionMat);
    pillow.position.set(0, bedH + bedH * 0.2, -bedD / 2 + bedD * 0.14);
    group.add(pillow);
  } else if (n.includes("cabinet") || n.includes("shelv") || n.includes("bookcase") || n.includes("storage") || n.includes("counter") || n.includes("island")) {
    const w = qW * 0.5, d = qD * 0.16, h = wallHeight * 0.55;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
    cab.position.y = h / 2;
    group.add(cab);
    const shelfMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });
    [0.35, 0.65].forEach((t) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 0.02, d * 1.01), shelfMat);
      shelf.position.y = h * t;
      group.add(shelf);
    });
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(qW * 0.3, wallHeight * 0.18, qD * 0.3), accentMat);
    box.position.y = wallHeight * 0.09;
    group.add(box);
  }

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

function floorColorForRoom(room) {
  const r = room.toLowerCase();
  if (r.includes("kitchen") || r.includes("dining")) return 0xd9d2c2;
  if (r.includes("wash") || r.includes("bath")) return 0xcdd8dc;
  if (r.includes("bedroom")) return 0xb98a5e;
  if (r.includes("mudroom") || r.includes("porch")) return 0x8a6b47;
  if (r.includes("study") || r.includes("office") || r.includes("utility")) return 0x9c7b52;
  return 0xa9784f; // lounge / default
}

/* ------------------------------------------------------------------ */
/* House construction — 3 columns x 2 rows of connected rooms          */
/* ------------------------------------------------------------------ */

function addWallSegment(orientation, fixed, start, end, gap, thickness, height, mat, group, obstacles) {
  const totalLen = end - start;
  const segLen = Math.max(0.03, (totalLen - gap) / 2);
  const seg1Center = start + segLen / 2;
  const seg2Center = end - segLen / 2;
  [seg1Center, seg2Center].forEach((centerCoord) => {
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
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    group.add(mesh);
    obstacles.push({ minX, maxX, minZ, maxZ });
  });
}

function buildHouse(widthFt, lengthFt, styleKey) {
  if (houseGroup) {
    scene.remove(houseGroup);
    disposeGroup(houseGroup);
  }

  const style = STYLES[styleKey];
  const group = new THREE.Group();

  const plotW = widthFt * FT;
  const plotL = lengthFt * FT;
  const houseW = plotW * 0.62;
  const houseL = plotL * 0.55;
  const wallHeight = 2.3 + Math.min(plotW, plotL) * 0.02;
  const wallThickness = Math.max(0.05, Math.min(houseW, houseL) * 0.025);

  const wallMat = new THREE.MeshStandardMaterial({ color: style.wallColor, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: style.trimColor, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: style.roofColor, roughness: 0.55 });
  const interiorWallMat = new THREE.MeshStandardMaterial({ color: 0xe4ded0, roughness: 0.92 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf2efe7, roughness: 0.95, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fc4d6, roughness: 0.1, metalness: 0.05, emissive: 0x24343c, emissiveIntensity: 0.25,
  });

  /* ---- exterior shell: back + side walls ---- */
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallHeight, wallThickness), wallMat);
  backWall.position.set(0, wallHeight / 2, -houseL / 2 + wallThickness / 2);
  backWall.castShadow = true; backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, houseL), wallMat);
  leftWall.position.set(-houseW / 2 + wallThickness / 2, wallHeight / 2, 0);
  leftWall.castShadow = true; leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = houseW / 2 - wallThickness / 2;
  group.add(rightWall);

  /* ---- 3x2 room grid ---- */
  const cols = 3, rows = 2;
  const innerW = houseW - wallThickness * 2;
  const innerD = houseL - wallThickness * 2;
  const cellW = innerW / cols;
  const cellD = innerD / rows;

  const cellCenters = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellCenters.push({
        x: -innerW / 2 + cellW * (c + 0.5),
        z: -innerD / 2 + cellD * (r + 0.5),
      });
    }
  }
  // index order: 0 back-left,1 back-center,2 back-right,3 front-left,4 front-center,5 front-right
  // style.rooms order: Kitchen, Washroom, Bedroom, 6th room, Lounge, Dining — maps 1:1 to cells 0..5

  const wallObstacles = [];
  const partitionHeight = wallHeight * 0.92;
  const gap = Math.min(cellW, cellD) * 0.34;

  const vBoundaries = [-innerW / 2 + cellW, -innerW / 2 + cellW * 2];
  vBoundaries.forEach((xPos) => {
    for (let r = 0; r < rows; r++) {
      const zStart = -innerD / 2 + cellD * r;
      addWallSegment("vertical", xPos, zStart, zStart + cellD, gap, wallThickness * 0.7, partitionHeight, interiorWallMat, group, wallObstacles);
    }
  });
  const hBoundaries = [-innerD / 2 + cellD];
  hBoundaries.forEach((zPos) => {
    for (let c = 0; c < cols; c++) {
      const xStart = -innerW / 2 + cellW * c;
      addWallSegment("horizontal", zPos, xStart, xStart + cellW, gap, wallThickness * 0.7, partitionHeight, interiorWallMat, group, wallObstacles);
    }
  });

  /* ---- floors, per room ---- */
  style.rooms.forEach((roomDef, idx) => {
    const center = cellCenters[idx];
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColorForRoom(roomDef.room), roughness: 0.82 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(cellW - 0.01, 0.05, cellD - 0.01), floorMat);
    floor.position.set(center.x, 0.025, center.z);
    floor.receiveShadow = true;
    group.add(floor);
  });

  /* ---- ceiling ---- */
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(houseW - wallThickness, 0.04, houseL - wallThickness), ceilingMat);
  ceiling.position.y = wallHeight - 0.02;
  group.add(ceiling);

  /* ---- lights, furniture, labels per room ---- */
  style.rooms.forEach((roomDef, idx) => {
    const center = cellCenters[idx];
    const lamp = new THREE.PointLight(0xffddaa, 0.45, Math.max(cellW, cellD) * 3, 2);
    lamp.position.set(center.x, wallHeight * 0.85, center.z);
    group.add(lamp);

    const label = makeRoomLabel(roomDef.room);
    label.position.set(center.x, wallHeight * 0.82, center.z);
    group.add(label);

    const items = roomDef.items;
    items.forEach((item, j) => {
      const spread = (j - (items.length - 1) / 2) * (cellD * 0.4);
      const piece = makeFurniturePiece(item, cellW, cellD, wallHeight, trimMat, style.accent);
      piece.position.set(center.x, 0, center.z + spread);
      group.add(piece);
    });
  });

  /* ---- glazing band (modern) ---- */
  if (style.glassBand) {
    const bandH = wallHeight * 0.32;
    const band = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.002, bandH, houseL * 1.002), glassMat);
    band.position.y = wallHeight * 0.62;
    group.add(band);
  }

  /* ---- roof: flat slab or a proper gable prism (extruded triangular profile) ---- */
  if (style.roofStyle === "flat") {
    const overhang = 1.12;
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(houseW * overhang, wallHeight * 0.05, houseL * overhang), trimMat);
    fascia.position.y = wallHeight + wallHeight * 0.025;
    group.add(fascia);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(houseW * (overhang - 0.02), wallHeight * 0.05, houseL * (overhang - 0.02)), roofMat);
    roof.position.y = wallHeight + wallHeight * 0.075;
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
    roofMesh.position.y = wallHeight;
    roofMesh.castShadow = true; roofMesh.receiveShadow = true;
    group.add(roofMesh);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.045, houseW * 0.045, depth), trimMat);
    ridge.position.set(0, wallHeight + roofHeight, 0);
    group.add(ridge);
  }

  /* ---- base ---- */
  const base = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.02, 0.14, houseL * 1.02), trimMat);
  base.position.y = 0.07;
  group.add(base);

  /* ---- front wall + door + windows (toggleable) ---- */
  const frontGroup = new THREE.Group();
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallHeight, wallThickness), wallMat);
  frontWall.position.set(0, wallHeight / 2, houseL / 2 - wallThickness / 2);
  frontWall.castShadow = true; frontWall.receiveShadow = true;
  frontGroup.add(frontWall);

  const doorW = houseW * 0.09;
  const doorH = wallHeight * 0.55;
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.22, doorH * 1.08, 0.05), trimMat);
  doorFrame.position.set(0, (doorH * 1.08) / 2, houseL / 2 + 0.018);
  frontGroup.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.045), new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.5 }));
  door.position.set(0, doorH / 2, houseL / 2 + 0.03);
  frontGroup.add(door);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(doorW * 0.06, 8, 8), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.3 }));
  handle.position.set(doorW * 0.32, doorH * 0.5, houseL / 2 + 0.06);
  frontGroup.add(handle);
  const step = new THREE.Mesh(new THREE.BoxGeometry(doorW * 1.8, 0.08, 0.32), trimMat);
  step.position.set(0, 0.04, houseL / 2 + 0.2);
  frontGroup.add(step);

  if (!style.glassBand) {
    const winCount = 3;
    const winW = houseW * 0.075;
    const winH = wallHeight * 0.3;
    const winY = wallHeight * 0.55;
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
  group.userData.frontGroup = frontGroup;

  /* ---- columns (colonial) ---- */
  if (style.columns) {
    const colH = wallHeight * 0.62;
    const colGeo = new THREE.CylinderGeometry(houseW * 0.02, houseW * 0.02, colH, 12);
    [-1, 1].forEach((side) => {
      const col = new THREE.Mesh(colGeo, trimMat);
      col.position.set(side * houseW * 0.16, colH / 2, houseL / 2 + 0.35);
      col.castShadow = true;
      group.add(col);
    });
    const pediment = new THREE.Mesh(new THREE.BoxGeometry(houseW * 0.42, 0.1, 0.5), trimMat);
    pediment.position.set(0, colH + 0.05, houseL / 2 + 0.35);
    group.add(pediment);
  }

  /* ---- porch (farmhouse) ---- */
  if (style.porch) {
    const porchDepth = houseL * 0.2;
    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.02, 0.08, porchDepth), trimMat);
    porchFloor.position.set(0, 0.04, houseL / 2 + porchDepth / 2);
    group.add(porchFloor);
    const roofOverhang = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.05, 0.06, porchDepth + 0.1), roofMat);
    roofOverhang.position.set(0, wallHeight * 0.72, houseL / 2 + porchDepth / 2);
    group.add(roofOverhang);
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, wallHeight * 0.72, 8);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const x = -houseW / 2 + t * houseW;
      const post = new THREE.Mesh(postGeo, trimMat);
      post.position.set(x, (wallHeight * 0.72) / 2, houseL / 2 + porchDepth - 0.1);
      group.add(post);
    }
  }

  scene.add(group);
  houseGroup = group;
  group.userData.span = Math.max(plotW, plotL);
  group.userData.wallHeight = wallHeight;
  group.userData.houseW = houseW;
  group.userData.houseL = houseL;
  group.userData.eyeHeight = wallHeight * 0.45;
  group.userData.wallObstacles = wallObstacles;

  fitCameraToObject(group.userData.span);
}

function fitCameraToObject(span, animated = false) {
  const dist = Math.max(6, span * 0.9);
  const angle = Math.PI / 4.4;
  const pos = new THREE.Vector3(Math.cos(angle) * dist, dist * 0.62, Math.sin(angle) * dist);
  const target = new THREE.Vector3(0, 1, 0);
  if (animated) tweenCamera(pos, target);
  else { camera.position.copy(pos); controls.target.copy(target); controls.update(); }
}

function fitCameraInterior(span, wallHeight, animated = false) {
  const pos = new THREE.Vector3(0, wallHeight * 0.85, span * 0.85);
  const target = new THREE.Vector3(0, wallHeight * 0.4, 0);
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
  houseGroup.userData.frontGroup.visible = !on;
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
  interiorMode = false; // walkthrough supersedes the dollhouse peek
  walkActive = true;
  controls.enabled = false;
  houseGroup.userData.frontGroup.visible = false;
  camera.position.set(0, houseGroup.userData.eyeHeight, houseGroup.userData.houseL / 2 - 0.3);
  camera.lookAt(0, houseGroup.userData.eyeHeight, 0);
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
    houseGroup.userData.frontGroup.visible = !interiorMode;
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
    houseGroup.userData.frontGroup.visible = !interiorMode;
    interiorToggleBtn.classList.toggle("active", interiorMode);
    interiorToggleBtn.textContent = interiorMode ? "Show exterior" : "Show interior";
    if (interiorMode) fitCameraInterior(houseGroup.userData.span, houseGroup.userData.wallHeight, false);
  }
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

/* ------------------------------------------------------------------ */
/* Title block date                                                     */
/* ------------------------------------------------------------------ */

const tbDate = document.getElementById("tbDate");
if (tbDate) tbDate.textContent = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Gold block easter egg on background click                           */
/* ------------------------------------------------------------------ */

document.addEventListener("click", (e) => {
  const excluded = e.target.closest(
    "form, .panel, .style-grid, .style-card, table, footer, header, button, input, a"
  );
  if (excluded) return;
  const block = document.createElement("div");
  block.className = "gold-pop";
  block.style.left = `${e.clientX}px`;
  block.style.top = `${e.clientY}px`;
  document.body.appendChild(block);
  block.addEventListener("animationend", () => block.remove());
});
