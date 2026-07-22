/* ============================================================
   BuildCraft — 3D house generator
   ============================================================ */

const STYLES = {
  modern: {
    label: 'Modern',
    color: 0xd8dbe0,
    accent: 0x2b2f36,
    roof: 'flat',
    swatch: 'linear-gradient(90deg,#d8dbe0,#2b2f36)',
    description: 'Clean lines, flat roof, large glazing. Suits narrower or compact plots.',
  },
  farmhouse: {
    label: 'Farmhouse',
    color: 0xe8e1d3,
    accent: 0x6b3f2a,
    roof: 'gable',
    swatch: 'linear-gradient(90deg,#e8e1d3,#6b3f2a)',
    description: 'Pitched gable roof, warm tones, wraparound feel. Suits wide, deep plots.',
  },
  colonial: {
    label: 'Colonial',
    color: 0xf1ece0,
    accent: 0x8a1f1f,
    roof: 'hip',
    swatch: 'linear-gradient(90deg,#f1ece0,#8a1f1f)',
    description: 'Symmetrical, hip roof, brick accents. Suits square, generous plots.',
  },
  minimalist: {
    label: 'Minimalist',
    color: 0xeeeeee,
    accent: 0xa9a9a9,
    roof: 'flat',
    swatch: 'linear-gradient(90deg,#eeeeee,#a9a9a9)',
    description: 'Pared-back volumes, monochrome palette. Suits small, narrow plots.',
  },
};

const FURNITURE = {
  modern: {
    living: ['Low-profile sectional sofa', 'Glass-top coffee table', 'Floating media console', 'Sculptural floor lamp'],
    bedroom: ['Platform bed frame', 'Built-in wardrobe wall', 'Minimal nightstands', 'Slim linear pendant light'],
    kitchen: ['Handle-less flat cabinets', 'Waterfall-edge island', 'Integrated appliances', 'Pendant lights over island'],
  },
  farmhouse: {
    living: ['Slipcovered sofa', 'Reclaimed-wood coffee table', 'Wingback accent chair', 'Wrought-iron floor lamp'],
    bedroom: ['Wood sleigh bed', 'Distressed dresser', 'Woven area rug', 'Barn-style nightstands'],
    kitchen: ['Farmhouse sink', 'Open shelving', 'Butcher-block island', 'Beadboard cabinet fronts'],
  },
  colonial: {
    living: ['Camelback sofa', 'Mahogany coffee table', 'Wingback chairs (pair)', 'Brass floor lamp'],
    bedroom: ['Four-poster bed', 'Chest-on-chest dresser', 'Upholstered bench', 'Crystal table lamps'],
    kitchen: ['Raised-panel cabinets', 'Marble-top island', 'Farmhouse dining table', 'Brass cabinet pulls'],
  },
  minimalist: {
    living: ['Low platform sofa', 'Single sculptural chair', 'Bare wood side table', 'Paper floor lamp'],
    bedroom: ['Floor-level bed frame', 'Single floating shelf', 'No nightstands — wall sconces', 'Neutral linen bedding'],
    kitchen: ['All-white flat cabinets', 'Single-slab island, no handles', 'Open floor plan, no upper cabinets', 'Hidden appliance garage'],
  },
};

let currentStyleKey = 'modern';
let currentRoomKey = 'living';

/* ------------------------------------------------------------
   Recommendation engine
   ------------------------------------------------------------ */
function recommend(width, length) {
  const area = width * length;
  const aspect = Math.max(width, length) / Math.min(width, length);

  let shape;
  if (aspect < 1.25) shape = 'Square';
  else if (aspect < 2.1) shape = 'Rectangular';
  else shape = 'Narrow';

  let floors = area < 1400 ? 1 : area < 3000 ? 2 : 3;

  let styleKey, title, text;
  if (shape === 'Square' && area >= 2200) {
    styleKey = 'colonial';
    title = 'A symmetrical colonial home';
    text = `A ${width}x${length} ft square plot of ${Math.round(area).toLocaleString()} sq ft gives you room for a balanced, symmetrical footprint. A colonial layout with a centered entry and hip roof makes the most of that generosity.`;
  } else if (shape === 'Narrow') {
    styleKey = 'minimalist';
    title = 'A minimalist, single-volume home';
    text = `At ${width}x${length} ft your plot is quite narrow (about ${aspect.toFixed(1)}:1). A minimalist plan with a simple rectangular volume and a flat roof avoids wasted circulation space and keeps the build efficient.`;
  } else if (shape === 'Rectangular' && area >= 2200) {
    styleKey = 'farmhouse';
    title = 'A farmhouse with a gable roof';
    text = `Your ${Math.round(area).toLocaleString()} sq ft rectangular plot has the depth for a farmhouse layout — a pitched gable roof and a wraparound porch both fit comfortably without crowding the lot.`;
  } else {
    styleKey = 'modern';
    title = 'A modern two-storey home';
    text = `Your plot's proportions (${width}x${length} ft, ${Math.round(area).toLocaleString()} sq ft) suit a compact, efficient footprint. A modern build with a flat roof and large windows makes the most of the width without overbuilding the lot.`;
  }

  return { area, aspect, shape, floors, styleKey, title, text };
}

/* ------------------------------------------------------------
   Three.js scene
   ------------------------------------------------------------ */
let scene, camera, renderer, houseGroup;
let dragging = false, lastX = 0, lastY = 0, rotY = 0.6, rotX = -0.25, autoRotate = true;

function initScene() {
  const holder = document.getElementById('canvas-holder');
  const w = holder.clientWidth, h = holder.clientHeight;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 4, 11);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  holder.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xfff2d8, 0.9);
  dir.position.set(6, 10, 4);
  scene.add(dir);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.25);
  rim.position.set(-6, 4, -6);
  scene.add(rim);

  const groundGeo = new THREE.PlaneGeometry(40, 40);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  const grid = new THREE.GridHelper(40, 40, 0x2c3648, 0x1e2635);
  scene.add(grid);

  houseGroup = new THREE.Group();
  scene.add(houseGroup);

  // drag to rotate
  const dom = renderer.domElement;
  dom.style.cursor = 'grab';
  dom.addEventListener('pointerdown', (e) => {
    dragging = true; autoRotate = false; lastX = e.clientX; lastY = e.clientY; dom.style.cursor = 'grabbing';
  });
  window.addEventListener('pointerup', () => { dragging = false; dom.style.cursor = 'grab'; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    rotY += (e.clientX - lastX) * 0.008;
    rotX += (e.clientY - lastY) * 0.005;
    rotX = Math.max(-0.6, Math.min(0.3, rotX));
    lastX = e.clientX; lastY = e.clientY;
  });

  window.addEventListener('resize', () => {
    const w2 = holder.clientWidth, h2 = holder.clientHeight;
    camera.aspect = w2 / h2;
    camera.updateProjectionMatrix();
    renderer.setSize(w2, h2);
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (autoRotate) rotY += 0.0025;
  const radius = 11;
  camera.position.x = Math.sin(rotY) * radius * Math.cos(rotX);
  camera.position.z = Math.cos(rotY) * radius * Math.cos(rotX);
  camera.position.y = 4 + Math.sin(rotX) * 6;
  camera.lookAt(0, 1.5, 0);
  renderer.render(scene, camera);
}

/* Build (or rebuild) the house mesh for given plot dims + style */
function buildHouse(width, length, styleKey) {
  while (houseGroup.children.length) houseGroup.remove(houseGroup.children[0]);

  const style = STYLES[styleKey];

  // scale real feet down to a viewable 3D footprint, capped
  const maxSpan = 6.5;
  const scale = maxSpan / Math.max(width, length);
  const bw = width * scale;
  const bl = length * scale;
  const floors = width * length < 1400 ? 1 : width * length < 3000 ? 2 : 3;
  const floorH = 1.15;
  const bh = floorH * Math.min(floors, 3);

  const wallMat = new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), wallMat);
  body.position.y = bh / 2;
  houseGroup.add(body);

  // windows (simple grid on the front face)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.2, metalness: 0.3 });
  const cols = Math.max(2, Math.round(bw / 0.9));
  for (let f = 0; f < Math.min(floors, 3); f++) {
    for (let c = 0; c < cols; c++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.02), winMat);
      win.position.set(-bw / 2 + (c + 0.5) * (bw / cols), f * floorH + floorH * 0.55, bl / 2 + 0.01);
      houseGroup.add(win);
    }
  }

  // door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.05), accentMat);
  door.position.set(0, 0.425, bl / 2 + 0.02);
  houseGroup.add(door);

  // roof
  if (style.roof === 'flat') {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.2, 0.18, bl + 0.2), accentMat);
    roof.position.y = bh + 0.09;
    houseGroup.add(roof);
  } else if (style.roof === 'hip') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(bw, bl) * 0.72, 1.1, 4), accentMat);
    roof.position.y = bh + 0.55;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(bw / Math.max(bw, bl), 1, bl / Math.max(bw, bl));
    houseGroup.add(roof);
  } else if (style.roof === 'gable') {
    const shape = new THREE.Shape();
    const hw = bw / 2, rh = 1.0;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(0, rh);
    shape.lineTo(-hw, 0);
    const extrudeSettings = { depth: bl, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const roof = new THREE.Mesh(geo, accentMat);
    roof.rotation.y = Math.PI / 2;
    roof.position.set(bw / 2, bh, -bl / 2);
    houseGroup.add(roof);
  }
}

/* ------------------------------------------------------------
   UI wiring
   ------------------------------------------------------------ */
function renderStyleGrid() {
  const grid = document.getElementById('style-grid');
  grid.innerHTML = '';
  Object.entries(STYLES).forEach(([key, s]) => {
    const card = document.createElement('div');
    card.className = 'style-card' + (key === currentStyleKey ? ' active' : '');
    card.innerHTML = `
      <div class="swatch" style="background:${s.swatch}"></div>
      <h3>${s.label}</h3>
      <p>${s.description}</p>
    `;
    card.addEventListener('click', () => {
      currentStyleKey = key;
      document.getElementById('stat-style').textContent = s.label;
      document.getElementById('furniture-style-label').textContent = s.label;
      renderStyleGrid();
      renderFurniture();
      const width = parseFloat(document.getElementById('width').value) || 35;
      const length = parseFloat(document.getElementById('length').value) || 60;
      buildHouse(width, length, currentStyleKey);
    });
    grid.appendChild(card);
  });
}

function renderRoomTabs() {
  const tabs = document.getElementById('room-tabs');
  tabs.innerHTML = '';
  const rooms = [['living', 'Living room'], ['bedroom', 'Bedroom'], ['kitchen', 'Kitchen']];
  rooms.forEach(([key, label]) => {
    const tab = document.createElement('div');
    tab.className = 'room-tab' + (key === currentRoomKey ? ' active' : '');
    tab.textContent = label;
    tab.addEventListener('click', () => {
      currentRoomKey = key;
      renderRoomTabs();
      renderFurniture();
    });
    tabs.appendChild(tab);
  });
}

function renderFurniture() {
  const list = document.getElementById('furniture-list');
  list.innerHTML = '';
  const items = FURNITURE[currentStyleKey][currentRoomKey];
  items.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>Pick</b>${item}`;
    list.appendChild(li);
  });
}

function runGeneration() {
  const width = parseFloat(document.getElementById('width').value) || 35;
  const length = parseFloat(document.getElementById('length').value) || 60;
  const result = recommend(width, length);

  document.getElementById('stat-area').textContent = `${Math.round(result.area).toLocaleString()} sq ft`;
  document.getElementById('stat-shape').textContent = result.shape;
  document.getElementById('stat-floors').textContent = result.floors;

  currentStyleKey = result.styleKey;
  document.getElementById('stat-style').textContent = STYLES[currentStyleKey].label;
  document.getElementById('furniture-style-label').textContent = STYLES[currentStyleKey].label;

  document.getElementById('sugg-title').textContent = result.title;
  document.getElementById('sugg-text').textContent = result.text;

  renderStyleGrid();
  renderFurniture();
  buildHouse(width, length, currentStyleKey);
}

document.getElementById('generate-btn').addEventListener('click', runGeneration);

/* ------------------------------------------------------------
   Interactive "classy" background: click anywhere to pop a block
   ------------------------------------------------------------ */
document.body.addEventListener('click', (e) => {
  // ignore clicks on interactive UI so it doesn't fire on every button/tap
  if (e.target.closest('button, input, select, a, .style-card, .room-tab, #canvas-holder')) return;

  const block = document.createElement('div');
  block.className = 'pop-block';
  block.style.left = (e.clientX - 13) + 'px';
  block.style.top = (e.clientY - 13) + 'px';
  block.innerHTML = `
    <div class="face top"></div>
    <div class="face front"></div>
  `;
  document.body.appendChild(block);
  setTimeout(() => block.remove(), 1200);
});

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
window.addEventListener('DOMContentLoaded', () => {
  initScene();
  renderStyleGrid();
  renderRoomTabs();
  renderFurniture();
  runGeneration();
});
