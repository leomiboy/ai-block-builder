// ──────────────────────────────────────────────
//  scene.js  —  Three.js 3D 場景初始化
//  等角透視（Orthographic Isometric View）
// ──────────────────────────────────────────────
import * as THREE from 'three';

export let scene, camera, renderer;

export function initScene(containerId) {
  const container = document.getElementById(containerId);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c1e);
  scene.fog = new THREE.FogExp2(0x0b0c1e, 0.035);

  // Orthographic isometric camera
  // 正視角：從 (1,1,1) 看向原點，Y軸朝上
  const aspect = container.clientWidth / container.clientHeight;
  const d = 10;
  camera = new THREE.OrthographicCamera(
    -d * aspect, d * aspect,
    d, -d,
    0.1, 200,
  );
  camera.position.set(14, 14, 14);
  camera.lookAt(0, 2, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0x8899dd, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(12, 20, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 80;
  dirLight.shadow.camera.left   = -20;
  dirLight.shadow.camera.right  =  20;
  dirLight.shadow.camera.top    =  20;
  dirLight.shadow.camera.bottom = -20;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  // 補光：讓積木側面也有光
  const fillLight = new THREE.DirectionalLight(0x4466ff, 0.4);
  fillLight.position.set(-10, 5, -10);
  scene.add(fillLight);

  // Floor and grid
  buildFloor();

  // Resize handler
  window.addEventListener('resize', () => {
    const a = container.clientWidth / container.clientHeight;
    camera.left   = -d * a;
    camera.right  =  d * a;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Render loop
  let running = true;
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    renderer.render(scene, camera);
  }
  loop();

  return { scene, camera, renderer, stop: () => { running = false; } };
}

function buildFloor() {
  // 地板面
  const floorGeo = new THREE.PlaneGeometry(24, 24);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x12142e,
    roughness: 0.9,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  // 格線
  const gridHelper = new THREE.GridHelper(12, 12, 0x233366, 0x1a2550);
  gridHelper.position.y = 0.001;
  scene.add(gridHelper);

  // 邊緣顏色條（方向識別）
  // 前方（+Z）→ 紅色
  addEdgeBar(0, 0,  6.1, 12, 0.15, 0xff4444);
  // 後方（-Z）→ 藍色
  addEdgeBar(0, 0, -6.1, 12, 0.15, 0x4488ff);
  // 右方（+X）→ 黃色
  addEdgeBar( 6.1, 0, 0, 0.15, 12, 0xffcc00);
  // 左方（-X）→ 綠色
  addEdgeBar(-6.1, 0, 0, 0.15, 12, 0x22cc66);

  // 中心十字標示
  const crossMat = new THREE.MeshBasicMaterial({ color: 0x334488, transparent: true, opacity: 0.5 });
  const crossH = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 12), crossMat);
  crossH.rotation.x = -Math.PI / 2;
  crossH.position.y = 0.005;
  scene.add(crossH);
  const crossV = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.1), crossMat);
  crossV.rotation.x = -Math.PI / 2;
  crossV.position.y = 0.005;
  scene.add(crossV);
}

function addEdgeBar(x, y, z, width, depth, color) {
  const geo = new THREE.BoxGeometry(width, 0.12, depth);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + 0.06, z);
  scene.add(mesh);
}

/** 格子座標 → Three.js 世界座標（XZ平面） */
export function gridToWorld(gridX, gridZ, cellSize = 4) {
  return { x: gridX * cellSize, z: gridZ * cellSize };
}
