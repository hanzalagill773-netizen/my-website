import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ------------------------------------------------------------------ */
/* Style + furniture data                                              */
/* ------------------------------------------------------------------ */

const STYLES = {
  modern: {
    label: "Modern",
    wallColor: 0xcfd4d8,
    trimColor: 0x2b2f33,
    roofColor: 0x2b2f33,
    roofStyle: "flat",
    glassBand: true,
    porch: false,
    furniture: [
      ["Living", "Low-profile sectional sofa"],
      ["Dining", "Glass-top dining table"],
      ["Bedroom", "Platform bed frame"],
      ["Living", "Floating shelving unit"],
    ],
  },
  farmhouse: {
    label: "Farmhouse",
    wallColor: 0xf1ece1,
    trimColor: 0x2a2a2a,
    roofColor: 0x2a2a2a,
    roofStyle: "gable-steep",
    glassBand: false,
    porch: true,
    furniture: [
      ["Dining", "Farmhouse trestle table"],
      ["Living", "Slipcovered sofa"],
      ["Kitchen", "Shaker-style cabinetry"],
      ["Porch", "Wraparound porch bench"],
    ],
  },
  colonial: {
    label: "Colonial",
    wallColor: 0xa84c3f,
    trimColor: 0xf3f1ea,
    roofColor: 0x33302c,
    roofStyle: "gable",
    glassBand: false,
    porch: false,
    columns: true,
    furniture: [
      ["Living", "Wingback armchairs"],
      ["Dining", "Pedestal dining table"],
      ["Bedroom", "Four-poster bed"],
      ["Study", "Built-in bookcases"],
    ],
  },
  minimalist: {
    label: "Minimalist",
    wallColor: 0xe4e4e2,
    trimColor: 0xbdbdb8,
    roofColor: 0xbdbdb8,
    roofStyle: "flat",
    glassBand: false,
    porch: false,
    furniture: [
      ["Living", "Modular sofa, single tone"],
      ["Dining", "Fold-away dining table"],
      ["Bedroom", "Low platform bed"],
      ["Living", "Built-in wall storage"],
    ],
  },
};

const STYLE_ORDER = ["modern", "farmhouse", "colonial", "minimalist"];

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
/* Scene setup                                                         */
/* ------------------------------------------------------------------ */

const FT = 0.09; // feet -> scene units

const host = document.getElementById("canvasHost");
const emptyState = document.getElementById("emptyState");
const canvasHint = document.getElementById("canvasHint");

let renderer, scene, camera, controls;
let houseGroup = null;
let groundGroup = null;
let currentStyleKey = "modern";
let currentPlot = { w: 40, l: 70 };
let initialized = false;

function initScene() {
  if (initialized) return;
  initialized = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a121c);
  scene.fog = new THREE.Fog(0x0a121c, 18, 46);

  camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 200);
  camera.position.set(9, 7, 11);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  host.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 1, 0);

  const hemi = new THREE.HemisphereLight(0x9fb6cc, 0x0a121c, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3d6, 1.05);
  sun.position.set(12, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x4d6a8a, 0.35);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  window.addEventListener("resize", onResize);
  animate();
}

function onResize() {
  if (!renderer) return;
  camera.aspect = host.clientWidth / host.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ */
/* Ground + blueprint plot outline                                     */
/* ------------------------------------------------------------------ */

function buildGround(widthFt, lengthFt) {
  if (groundGroup) {
    scene.remove(groundGroup);
    disposeGroup(groundGroup);
  }
  groundGroup = new THREE.Group();

  const w = widthFt * FT;
  const l = lengthFt * FT;

  const padW = w + 4;
  const padL = l + 4;
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0e1a29, roughness: 1 });
  const groundGeo = new THREE.PlaneGeometry(padW, padL);
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  groundGroup.add(groundMesh);

  const grid = new THREE.GridHelper(Math.max(padW, padL), Math.round(Math.max(padW, padL) / (FT * 5)), 0x2a4258, 0x1a2c3f);
  grid.position.y = 0.001;
  groundGroup.add(grid);

  const outlinePts = [
    new THREE.Vector3(-w / 2, 0.01, -l / 2),
    new THREE.Vector3(w / 2, 0.01, -l / 2),
    new THREE.Vector3(w / 2, 0.01, l / 2),
    new THREE.Vector3(-w / 2, 0.01, l / 2),
    new THREE.Vector3(-w / 2, 0.01, -l / 2),
  ];
  const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
  const outlineMat = new THREE.LineDashedMaterial({ color: 0xc9a227, dashSize: 0.18, gapSize: 0.1 });
  const outline = new THREE.Line(outlineGeo, outlineMat);
  outline.computeLineDistances();
  groundGroup.add(outline);

  scene.add(groundGroup);
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
/* House construction                                                   */
/* ------------------------------------------------------------------ */

function makeFurniturePiece(name, qW, qD, wallHeight, trimMat, accentColor) {
  const group = new THREE.Group();
  const n = name.toLowerCase();
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.65 });

  if (n.includes("sofa") || n.includes("sectional") || n.includes("bench") || n.includes("armchair") || n.includes("chair")) {
    const seatW = qW * 0.55, seatD = qD * 0.34, seatH = wallHeight * 0.15;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(seatW, seatH, seatD), accentMat);
    seat.position.y = seatH / 2;
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(seatW, seatH * 1.5, seatD * 0.16), accentMat);
    back.position.set(0, seatH + (seatH * 1.5) * 0.4, -seatD / 2 + seatD * 0.08);
    group.add(back);
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
  } else if (n.includes("bed")) {
    const bedW = qW * 0.55, bedD = qD * 0.55, bedH = wallHeight * 0.14;
    const base = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedH, bedD), accentMat);
    base.position.y = bedH / 2;
    group.add(base);
    const head = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallHeight * 0.32, bedD * 0.06), trimMat);
    head.position.set(0, bedH + wallHeight * 0.16, -bedD / 2);
    group.add(head);
  } else if (n.includes("cabinet") || n.includes("shelv") || n.includes("bookcase") || n.includes("storage")) {
    const w = qW * 0.5, d = qD * 0.16, h = wallHeight * 0.55;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
    cab.position.y = h / 2;
    group.add(cab);
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

function buildHouse(widthFt, lengthFt, styleKey) {
  if (houseGroup) {
    scene.remove(houseGroup);
    disposeGroup(houseGroup);
  }

  const style = STYLES[styleKey];
  const group = new THREE.Group();

  // footprint: house sits within the plot with a setback margin
  const plotW = widthFt * FT;
  const plotL = lengthFt * FT;
  const houseW = plotW * 0.58;
  const houseL = plotL * 0.5;
  const wallHeight = 2.3 + Math.min(plotW, plotL) * 0.02;
  const wallThickness = Math.max(0.05, Math.min(houseW, houseL) * 0.03);

  const wallMat = new THREE.MeshStandardMaterial({ color: style.wallColor, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: style.trimColor, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: style.roofColor, roughness: 0.5 });
  const interiorWallMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xb79f7c, roughness: 0.8 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8fb8cc,
    roughness: 0.15,
    metalness: 0.1,
    emissive: 0x1a2c33,
    emissiveIntensity: 0.4,
  });

  // back + side walls (always visible — the exterior "shell" minus the front)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallHeight, wallThickness), wallMat);
  backWall.position.set(0, wallHeight / 2, -houseL / 2 + wallThickness / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, houseL), wallMat);
  leftWall.position.set(-houseW / 2 + wallThickness / 2, wallHeight / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = houseW / 2 - wallThickness / 2;
  group.add(rightWall);

  // interior floor slab
  const interiorFloor = new THREE.Mesh(new THREE.BoxGeometry(houseW - wallThickness * 2, 0.05, houseL - wallThickness * 2), floorMat);
  interiorFloor.position.y = 0.025;
  interiorFloor.receiveShadow = true;
  group.add(interiorFloor);

  // interior partition walls — split the footprint into up to 4 rooms (a "+" layout)
  const partitionHeight = wallHeight * 0.92;
  const partitionA = new THREE.Mesh(
    new THREE.BoxGeometry(houseW - wallThickness * 2, partitionHeight, wallThickness * 0.7),
    interiorWallMat
  );
  partitionA.position.set(0, partitionHeight / 2, 0);
  partitionA.castShadow = true;
  group.add(partitionA);

  const partitionB = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness * 0.7, partitionHeight, houseL - wallThickness * 2),
    interiorWallMat
  );
  partitionB.position.set(0, partitionHeight / 2, 0);
  partitionB.castShadow = true;
  group.add(partitionB);

  // furniture — assign each unique room to a quadrant, place its pieces inside
  const qW = (houseW - wallThickness * 2) / 2;
  const qD = (houseL - wallThickness * 2) / 2;
  const quadrantCenters = [
    { x: -qW / 2, z: qD / 2 }, // front-left
    { x: qW / 2, z: qD / 2 }, // front-right
    { x: -qW / 2, z: -qD / 2 }, // back-left
    { x: qW / 2, z: -qD / 2 }, // back-right
  ];
  const roomQuadrant = {};
  let qIdx = 0;
  const roomCounts = {};
  style.furniture.forEach(([room]) => {
    if (!(room in roomQuadrant)) {
      roomQuadrant[room] = qIdx % 4;
      qIdx++;
    }
    roomCounts[room] = (roomCounts[room] || 0) + 1;
  });
  const roomPlaced = {};
  style.furniture.forEach(([room, item]) => {
    const center = quadrantCenters[roomQuadrant[room]];
    const placedSoFar = roomPlaced[room] || 0;
    const totalInRoom = roomCounts[room];
    const spread = (placedSoFar - (totalInRoom - 1) / 2) * (qD * 0.45);
    roomPlaced[room] = placedSoFar + 1;

    const piece = makeFurniturePiece(item, qW, qD, wallHeight, trimMat, style.wallColor === 0xa84c3f ? 0x5b7a8c : 0xc9a227);
    piece.position.set(center.x, 0, center.z + spread);
    group.add(piece);
  });

  // glazing band (modern) — wraps the full perimeter
  if (style.glassBand) {
    const bandH = wallHeight * 0.32;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(houseW * 1.002, bandH, houseL * 1.002),
      glassMat
    );
    band.position.y = wallHeight * 0.62;
    group.add(band);
  }

  // roof — geometry is rotated in-place (baked), then the mesh is scaled along
  // world Z to fit the house's length. Scaling before baking the rotation would
  // stretch the roof diagonally instead of lengthwise, which is what caused it
  // to render detached and off to one side.
  if (style.roofStyle === "flat") {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.06, wallHeight * 0.08, houseL * 1.06), roofMat);
    roof.position.y = wallHeight + wallHeight * 0.04;
    roof.castShadow = true;
    group.add(roof);
  } else {
    const pitch = style.roofStyle === "gable-steep" ? 1.0 : 0.65;
    const roofHeight = (houseW / 2) * pitch;

    const geo = new THREE.CylinderGeometry(0, houseW / Math.SQRT2, roofHeight, 4, 1);
    geo.rotateY(Math.PI / 4); // bake the alignment rotation into the geometry itself
    const roofMesh = new THREE.Mesh(geo, roofMat);
    roofMesh.scale.z = houseL / houseW; // now scales lengthwise, in world space
    roofMesh.position.y = wallHeight + roofHeight / 2;
    roofMesh.castShadow = true;
    group.add(roofMesh);
  }

  // trim / base course
  const base = new THREE.Mesh(new THREE.BoxGeometry(houseW * 1.01, 0.12, houseL * 1.01), trimMat);
  base.position.y = 0.06;
  group.add(base);

  // front wall + door + windows — grouped so it can be toggled off for an interior view
  const frontGroup = new THREE.Group();

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(houseW, wallHeight, wallThickness), wallMat);
  frontWall.position.set(0, wallHeight / 2, houseL / 2 - wallThickness / 2);
  frontWall.castShadow = true;
  frontWall.receiveShadow = true;
  frontGroup.add(frontWall);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(houseW * 0.09, wallHeight * 0.55, 0.04),
    trimMat
  );
  door.position.set(0, (wallHeight * 0.55) / 2, houseL / 2 + 0.021);
  frontGroup.add(door);

  // simple window grid on front (skip for glass-band style, fewer for minimalist)
  if (!style.glassBand) {
    const winCount = styleKey === "minimalist" ? 2 : 3;
    const winW = houseW * 0.09;
    const winH = wallHeight * 0.3;
    for (let i = 0; i < winCount; i++) {
      const t = (i + 1) / (winCount + 1);
      const x = -houseW / 2 + t * houseW;
      if (Math.abs(x) < houseW * 0.08) continue; // avoid overlapping door
      const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.03), glassMat);
      win.position.set(x, wallHeight * 0.55, houseL / 2 + 0.021);
      frontGroup.add(win);
    }
  }

  group.add(frontGroup);
  group.userData.frontGroup = frontGroup;

  // columns (colonial)
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

  // porch (farmhouse) — extends along the long front face
  if (style.porch) {
    const porchDepth = houseL * 0.22;
    const porchFloor = new THREE.Mesh(
      new THREE.BoxGeometry(houseW * 1.02, 0.08, porchDepth),
      trimMat
    );
    porchFloor.position.set(0, 0.04, houseL / 2 + porchDepth / 2);
    group.add(porchFloor);

    const roofOverhang = new THREE.Mesh(
      new THREE.BoxGeometry(houseW * 1.05, 0.06, porchDepth + 0.1),
      roofMat
    );
    roofOverhang.position.set(0, wallHeight * 0.72, houseL / 2 + porchDepth / 2);
    group.add(roofOverhang);

    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, wallHeight * 0.72, 8);
    const postCount = 4;
    for (let i = 0; i < postCount; i++) {
      const t = i / (postCount - 1);
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

  fitCameraToObject(group, group.userData.span);
}

function fitCameraToObject(group, span) {
  const dist = Math.max(6, span * 0.9);
  const angle = Math.PI / 4.4;
  camera.position.set(
    Math.cos(angle) * dist,
    dist * 0.62,
    Math.sin(angle) * dist
  );
  controls.target.set(0, 1, 0);
  controls.update();
}

function fitCameraInterior(span, wallHeight) {
  camera.position.set(0, wallHeight * 0.85, span * 0.85);
  controls.target.set(0, wallHeight * 0.4, 0);
  controls.update();
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
let interiorMode = false;

function setInteriorMode(on) {
  interiorMode = on;
  if (!houseGroup) return;
  houseGroup.userData.frontGroup.visible = !on;
  interiorToggleBtn.textContent = on ? "Show exterior" : "Show interior";
  interiorToggleBtn.classList.toggle("active", on);
  const span = houseGroup.userData.span;
  const wallHeight = houseGroup.userData.wallHeight;
  if (on) fitCameraInterior(span, wallHeight);
  else fitCameraToObject(houseGroup, span);
}

interiorToggleBtn.addEventListener("click", () => setInteriorMode(!interiorMode));

function renderFurniture(styleKey) {
  const items = STYLES[styleKey].furniture;
  furnitureBody.innerHTML = "";
  items.forEach((item, idx) => {
    const tr = document.createElement("tr");
    const num = String(idx + 1).padStart(2, "0");
    tr.innerHTML = `<td class="item-num">${num}</td><td class="item-room">${item[0]}</td><td>${item[1]}</td>`;
    furnitureBody.appendChild(tr);
  });
}

function setActiveCard(styleKey) {
  [...styleGrid.children].forEach((card) => {
    card.classList.toggle("active", card.dataset.style === styleKey);
  });
}

function applyStyle(styleKey, { rebuildHouse = true } = {}) {
  currentStyleKey = styleKey;
  setActiveCard(styleKey);
  renderFurniture(styleKey);
  if (rebuildHouse && houseGroup) {
    buildHouse(currentPlot.w, currentPlot.l, styleKey);
    // rebuilding creates a fresh frontGroup — reapply the current view mode
    // without re-framing the camera, so switching styles doesn't jump the view
    houseGroup.userData.frontGroup.visible = !interiorMode;
    interiorToggleBtn.classList.toggle("active", interiorMode);
    interiorToggleBtn.textContent = interiorMode ? "Show exterior" : "Show interior";
    if (interiorMode) fitCameraInterior(houseGroup.userData.span, houseGroup.userData.wallHeight);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const w = parseFloat(document.getElementById("plotWidth").value);
  const l = parseFloat(document.getElementById("plotLength").value);
  if (!w || !l || w <= 0 || l <= 0) return;

  currentPlot = { w, l };

  initScene();
  emptyState.style.display = "none";
  canvasHint.style.display = "block";
  interiorToggleBtn.style.display = "block";

  const rec = recommendStyle(w, l);
  recStyleEl.textContent = STYLES[rec.key].label;
  recReasonEl.textContent = rec.reason;
  recBox.classList.add("show");

  buildGround(w, l);
  applyStyle(rec.key, { rebuildHouse: false });
  buildHouse(w, l, rec.key);
  setInteriorMode(false);
});

styleGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".style-card");
  if (!card) return;
  const styleKey = card.dataset.style;
  applyStyle(styleKey);
});

// initial furniture preview before first generate
renderFurniture(currentStyleKey);
setActiveCard(currentStyleKey);

/* ------------------------------------------------------------------ */
/* Title block date                                                     */
/* ------------------------------------------------------------------ */

const tbDate = document.getElementById("tbDate");
if (tbDate) {
  const d = new Date();
  tbDate.textContent = d.toISOString().slice(0, 10);
}

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
