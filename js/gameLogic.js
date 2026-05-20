// ──────────────────────────────────────────────
//  gameLogic.js  —  遊戲狀態機與勝負判定
// ──────────────────────────────────────────────
import { LEVELS, CELL, MAX_FAILS, COLORS, BLOCK_STATES } from './config.js';
import { Block, computeStackY, setBlockScene } from './block.js';

export class GameLogic {
  constructor(scene) {
    setBlockScene(scene);
    this.scene  = scene;
    this.reset();
  }

  reset() {
    this.blocks      = [];   // 所有 Block 實例
    this.history     = [];   // Undo 記錄 [{gridX,gridZ,state,stackY,isPlaced}]
    this.failCount   = 0;
    this.layersDone  = 0;
    this.totalLayers = 1;
    this.levelDef    = null;
    this.difficulty  = 'tutorial';
    this.levelIndex  = 0;
  }

  // ── 初始化關卡 ───────────────────────────────
  loadLevel(levelDef, difficulty) {
    // 清除舊積木
    this.blocks.forEach(b => b.dispose());
    this.blocks  = [];
    this.history = [];
    this.failCount  = 0;
    this.layersDone = 0;

    this.levelDef    = levelDef;
    this.difficulty  = difficulty;
    this.totalLayers = levelDef.layers ?? 1;

    // 建立積木（放在候選區）
    levelDef.available.forEach((avail, i) => {
      const stagingX = (i - Math.floor(levelDef.available.length / 2)) * 1.5;
      const b = new Block({
        color:     avail.color,
        id:        avail.id,
        state:     avail.state,
        gridX:     stagingX,   // 候選區位置（非整數格，純顯示用）
        gridZ:     -3,         // 放在場地前方
        isStaging: true,
      });
      b.stackY = 0;
      b._syncMeshPosition();
      this.blocks.push(b);
    });
  }

  /** 取得正確難度的下一關 */
  static getLevelsForDifficulty(difficulty) {
    return LEVELS.filter(l => l.difficulty === difficulty || difficulty === 'tutorial');
  }

  // ── 積木查詢 ─────────────────────────────────
  findBlock(color, id) {
    return this.blocks.find(b => b.color === color && b.id === id) ?? null;
  }

  getHeldBlock() {
    return this.blocks.find(b => b.isHeld) ?? null;
  }

  /** 計算一個 gridX/gridZ 位置的堆疊高度（底部Y） */
  stackYAt(gridX, gridZ, excluding = null) {
    return computeStackY(this.blocks, gridX, gridZ, excluding);
  }

  // ── Undo 快照 ────────────────────────────────
  saveSnapshot() {
    this.history.push(
      this.blocks.map(b => ({
        color:    b.color,
        id:       b.id,
        state:    b.state,
        gridX:    b.gridX,
        gridZ:    b.gridZ,
        stackY:   b.stackY,
        isPlaced: b.isPlaced,
        isHeld:   false,
      })),
    );
    if (this.history.length > 20) this.history.shift();
  }

  applySnapshot(snap) {
    snap.forEach(s => {
      const b = this.findBlock(s.color, s.id);
      if (!b) return;
      if (b.state !== s.state) b.changeState(s.state);
      b.gridX    = s.gridX;
      b.gridZ    = s.gridZ;
      b.stackY   = s.stackY;
      b.isPlaced = s.isPlaced;
      b.isHeld   = false;
      b._syncMeshPosition();
    });
  }

  undo() {
    if (this.history.length === 0) return false;
    const snap = this.history.pop();
    this.applySnapshot(snap);
    return true;
  }

  // ── 勝負判定 ─────────────────────────────────
  /**
   * 檢查玩家現在的積木排列是否符合目標
   * @returns {{ done: boolean, layersDone: number }}
   */
  checkWin() {
    const target = this.levelDef.target;
    let matched = 0;

    for (const t of target) {
      const b = this.findBlock(t.color, t.id);
      if (!b || b.isStaging || !b.isPlaced) continue;

      // 比較格子座標（允許 ±0.5 誤差，候選區調整後的小數）
      if (Math.abs(b.gridX - t.gridX) > 0.6) continue;
      if (Math.abs(b.gridZ - t.gridZ) > 0.6) continue;
      // 比較狀態
      if (b.state !== t.state) continue;

      matched++;
    }

    const done = matched === target.length;
    // 更新分層進度（依照 onTopOf 深度分層）
    this.layersDone = this._countLayersDone(target);

    return { done, layersDone: this.layersDone };
  }

  _countLayersDone(target) {
    // 計算有多少層已正確疊好（從最底層往上）
    let layers = 0;
    const sorted = [...target].sort((a, b) => {
      const depthA = this._chainDepth(a, target);
      const depthB = this._chainDepth(b, target);
      return depthA - depthB;
    });
    for (const t of sorted) {
      const b = this.findBlock(t.color, t.id);
      if (!b || !b.isPlaced) break;
      if (Math.abs(b.gridX - t.gridX) > 0.6) break;
      if (Math.abs(b.gridZ - t.gridZ) > 0.6) break;
      if (b.state !== t.state) break;
      layers++;
    }
    return layers;
  }

  _chainDepth(t, target) {
    if (!t.onTopOf) return 0;
    const parent = target.find(x => x.color === t.onTopOf.color && x.id === t.onTopOf.id);
    return parent ? 1 + this._chainDepth(parent, target) : 1;
  }

  // ── 積木資訊（給 Gemini Prompt 用） ─────────
  getBlockInfoList() {
    return this.blocks.map(b => ({
      colorName: COLORS[b.color].name,
      id:        b.id,
      state:     b.state,
      isHeld:    b.isHeld,
      isPlaced:  b.isPlaced,
    }));
  }

  // ── Ghost Block 提示 ─────────────────────────
  showGhostForTarget() {
    const target = this.levelDef.target;
    // 找第一個還沒放好的目標
    const pending = target.find(t => {
      const b = this.findBlock(t.color, t.id);
      return !b || !b.isPlaced ||
        Math.abs(b.gridX - t.gridX) > 0.6 ||
        Math.abs(b.gridZ - t.gridZ) > 0.6;
    });
    if (!pending) return null;

    const b = this.findBlock(pending.color, pending.id);
    if (!b) return null;

    const stackY = this.stackYAt(pending.gridX, pending.gridZ);
    b.showGhost(pending.gridX, pending.gridZ, stackY, pending.state);

    return {
      block: b,
      targetState: pending.state,
      targetGridX: pending.gridX,
      targetGridZ: pending.gridZ,
    };
  }

  hideAllGhosts() {
    this.blocks.forEach(b => b.hideGhost());
  }

  tickGhosts() {
    this.blocks.forEach(b => b.tickGhost());
  }
}
