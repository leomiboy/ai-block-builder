// ──────────────────────────────────────────────
//  block.js  —  積木類別
//  6 種放置狀態、顏色、X-Ray 透視模式
// ──────────────────────────────────────────────
import * as THREE from 'three';
import { BLOCK_STATES, COLORS, CELL } from './config.js';

let _scene = null;
export function setBlockScene(scene) { _scene = scene; }

export class Block {
  /**
   * @param {object} opts
   * @param {string}  opts.color   - 'red' | 'yellow' | 'blue' | 'green'
   * @param {number}  opts.id      - 積木編號（同顏色中的序號）
   * @param {number}  opts.state   - 1-6，放置狀態
   * @param {number}  opts.gridX   - 格子 X 座標
   * @param {number}  opts.gridZ   - 格子 Z 座標
   * @param {boolean} opts.isStaging - true=放在候選區，不需高度堆疊判斷
   */
  constructor({ color, id, state = 4, gridX = 0, gridZ = 0, isStaging = false }) {
    this.color   = color;
    this.id      = id;
    this.state   = state;
    this.gridX   = gridX;
    this.gridZ   = gridZ;
    this.stackY  = 0;       // 底部 Y 位置（由 gameLogic 計算後寫入）
    this.isStaging = isStaging;
    this.isHeld  = false;
    this.isPlaced = false;  // 已放到目標區

    this.mesh    = null;
    this.label   = null;    // 數字標籤（CSS2D 或 Sprite）
    this.ghost   = null;    // Ghost block mesh

    this._buildMesh();

    if (_scene) _scene.add(this.mesh);
  }

  // ── 幾何相關 ────────────────────────────────
  get dims()   { return BLOCK_STATES[this.state - 1]; }  // [w, h, d]
  get width()  { return this.dims[0]; }
  get height() { return this.dims[1]; }
  get depth()  { return this.dims[2]; }

  /** 積木中心點的 Y 座標 */
  get centerY() { return this.stackY + this.height / 2; }

  /** 積木頂面的 Y 座標 */
  get topY() { return this.stackY + this.height; }

  /** 世界座標（中心點） */
  get worldPos() {
    return new THREE.Vector3(
      this.gridX * CELL,
      this.centerY,
      this.gridZ * CELL,
    );
  }

  // ── 建立 Mesh ────────────────────────────────
  _buildMesh() {
    const [w, h, d] = this.dims;
    const geo = new THREE.BoxGeometry(w, h, d);

    const colorDef = COLORS[this.color];
    const mat = new THREE.MeshStandardMaterial({
      color: colorDef.hex,
      roughness: 0.4,
      metalness: 0.1,
      // 微透明（X-Ray 模式用）
      transparent: false,
      opacity: 1,
    });

    // 邊緣略深的線框，增加立體感
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
    });
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow    = true;
    this.mesh.receiveShadow = true;
    this.mesh.add(edgeLine);

    // metadata 方便射線檢測反查
    this.mesh.userData.block = this;

    // 角落螢光條（頂面）—— 增加電子風格
    this._addGlowEdge(colorDef.hex);

    this._syncMeshPosition();
  }

  _addGlowEdge(color) {
    const [w, , d] = this.dims;
    const h = this.height;
    const glowMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6,
    });
    // 頂面四條邊的凸出細條
    const corners = [
      { pos: [0, h/2, 0], size: [w + 0.06, 0.05, 0.05] },   // front
      { pos: [0, h/2, 0], size: [0.05, 0.05, d + 0.06] },   // side
    ];
    corners.forEach(({ pos, size }) => {
      const g = new THREE.BoxGeometry(...size);
      const m = new THREE.Mesh(g, glowMat);
      m.position.set(...pos);
      this.mesh.add(m);
    });
  }

  // ── 位置同步 ─────────────────────────────────
  _syncMeshPosition() {
    if (!this.mesh) return;
    this.mesh.position.set(
      this.gridX * CELL,
      this.centerY,
      this.gridZ * CELL,
    );
  }

  /** 更新 gridX/gridZ/stackY 並立即移動 mesh */
  setGridPos(gridX, gridZ, stackY = 0) {
    this.gridX  = gridX;
    this.gridZ  = gridZ;
    this.stackY = stackY;
    this._syncMeshPosition();
  }

  // ── 狀態切換 ─────────────────────────────────
  changeState(newState) {
    this.state = newState;
    const [w, h, d] = this.dims;

    // 重建幾何（保留材質）
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.BoxGeometry(w, h, d);

    // 重組邊線
    this.mesh.children.forEach(c => {
      if (c instanceof THREE.LineSegments) {
        c.geometry.dispose();
        c.geometry = new THREE.EdgesGeometry(this.mesh.geometry);
      }
    });

    // Y 位置更新（height 改變）
    this._syncMeshPosition();
  }

  // ── X-Ray 模式 ───────────────────────────────
  setXRay(on) {
    this.mesh.material.transparent = on;
    this.mesh.material.opacity      = on ? 0.3 : 1.0;
    this.mesh.material.depthWrite   = !on;
  }

  // ── Ghost Block（提示半透明位置） ────────────
  showGhost(gridX, gridZ, stackY, state) {
    this.hideGhost();
    const [w, h, d] = BLOCK_STATES[state - 1];
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      emissive: 0x8866ff,
      emissiveIntensity: 0.5,
    });
    this.ghost = new THREE.Mesh(geo, mat);
    this.ghost.position.set(
      gridX * CELL,
      stackY + h / 2,
      gridZ * CELL,
    );
    if (_scene) _scene.add(this.ghost);

    // 發光脈動動畫
    let t = 0;
    this._ghostAnim = () => {
      t += 0.05;
      if (this.ghost) this.ghost.material.opacity = 0.15 + 0.15 * Math.sin(t);
    };
  }

  hideGhost() {
    if (this.ghost && _scene) {
      _scene.remove(this.ghost);
      this.ghost.geometry.dispose();
      this.ghost.material.dispose();
      this.ghost = null;
    }
    this._ghostAnim = null;
  }

  tickGhost() {
    if (this._ghostAnim) this._ghostAnim();
  }

  // ── 銷毀 ─────────────────────────────────────
  dispose() {
    this.hideGhost();
    if (this.mesh && _scene) {
      _scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }

  // ── 工具方法 ─────────────────────────────────
  get key() { return `${this.color}-${this.id}`; }

  toString() {
    return `${COLORS[this.color].name}${this.id}號 (狀態${this.state})`;
  }
}

/**
 * 計算積木堆疊的底部 Y
 * @param {Block[]} blocks  - 目前場上的所有積木
 * @param {number}  gridX
 * @param {number}  gridZ
 * @param {Block}   [excluding]  - 排除計算中的某一塊（放置時傳入自己）
 */
export function computeStackY(blocks, gridX, gridZ, excluding = null) {
  let topY = 0;
  for (const b of blocks) {
    if (b === excluding) continue;
    if (b.gridX === gridX && b.gridZ === gridZ) {
      topY = Math.max(topY, b.topY);
    }
  }
  return topY;
}
