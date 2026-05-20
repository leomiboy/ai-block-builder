// ──────────────────────────────────────────────
//  commandRunner.js  —  JSON 指令 → 動畫執行
//  串接 Arm + GameLogic，並處理錯誤/追問
// ──────────────────────────────────────────────
import { COLORS, COLOR_NAME_MAP, CELL, MAX_FAILS } from './config.js';

export class CommandRunner {
  /**
   * @param {import('./arm.js').Arm}           arm
   * @param {import('./gameLogic.js').GameLogic} game
   * @param {object} ui  - { setCommand, setStatus, showClarify, onLayerDone, onWin }
   */
  constructor(arm, game, ui) {
    this.arm  = arm;
    this.game = game;
    this.ui   = ui;
    this.busy = false;
    this._pendingClarify = null; // 等待補充的指令
  }

  /** 主入口：執行 Gemini 回傳的指令物件 */
  async run(cmd) {
    if (this.busy) return;

    // ── 追問流程 ─────────────────────────────
    if (cmd.needClarify) {
      this.ui.setCommand('🤔 ' + cmd.clarifyQuestion, 'clarify');
      this._pendingClarify = cmd;
      return;
    }

    // ── 未知指令 ─────────────────────────────
    if (cmd.action === 'unknown') {
      this.ui.setCommand('❓ ' + (cmd.errorMsg ?? '聽不懂，再說一次？'), 'error');
      this._incrementFail();
      return;
    }

    // ── Undo ─────────────────────────────────
    if (cmd.action === 'undo') {
      const ok = this.game.undo();
      this.ui.setCommand(ok ? '⏪ 時光倒流！' : '📦 沒有可以退回的動作', ok ? 'success' : 'error');
      this.ui.refreshBlockList(this.game.blocks);
      return;
    }

    this.busy = true;
    this.game.saveSnapshot();

    try {
      this.game.hideAllGhosts();
      await this._dispatch(cmd);
    } catch (err) {
      console.error('[CommandRunner]', err);
      this.ui.setCommand('⚠️ 出錯了：' + err.message, 'error');
    } finally {
      this.busy = false;
    }
  }

  // ── 指令分派 ─────────────────────────────
  async _dispatch(cmd) {
    const { action, target, relativeTo, relativePos } = cmd;

    switch (action) {

      // 拿起積木
      case 'grab': {
        if (!target) { this._fail('請說要拿哪一塊積木'); return; }
        const block = this._resolveBlock(target);
        if (!block) { this._fail(`找不到 ${this._blockName(target)}`); return; }
        if (block.isHeld) { this._fail('我已經拿著它了！'); return; }

        // 若手上已有積木，先放回原位
        const held = this.game.getHeldBlock();
        if (held) {
          held.isHeld = false;
          held._syncMeshPosition();
          this.arm.releaseHeld();
        }

        this.ui.setCommand(`🦾 拿起 ${block.toString()}`, 'ai-processing');
        await this.arm.grab(block);
        this.ui.setCommand(`✅ 拿到了！接下來要怎麼做？`, 'success');
        this.ui.refreshBlockList(this.game.blocks);
        break;
      }

      // 旋轉 / 躺平 / 側躺 / 站立
      case 'rotate':
      case 'layFlat':
      case 'sideDown':
      case 'standUp': {
        const held = this.game.getHeldBlock();
        if (!held) { this._fail('我還沒拿任何積木，先說「拿起＿＿」！'); return; }
        const actionNames = {
          rotate: '轉 90 度', layFlat: '躺平', sideDown: '側躺', standUp: '站立',
        };
        this.ui.setCommand(`🔄 ${actionNames[action]}`, 'ai-processing');
        await this.arm.rotateBlock(action);
        this.ui.setCommand(`✅ 好，接下來要放哪裡？`, 'success');
        break;
      }

      // 放置
      case 'place': {
        const held = this.game.getHeldBlock();
        if (!held) { this._fail('我還沒拿任何積木！'); return; }

        let gridX = cmd.gridX ?? 0;
        let gridZ = cmd.gridZ ?? 0;

        // 若是「放在＿的上面/旁邊」
        if (relativeTo) {
          const refBlock = this._resolveBlock(relativeTo);
          if (!refBlock) { this._fail(`找不到 ${this._blockName(relativeTo)}`); return; }
          const offset = this._posOffset(relativePos ?? 'above');
          gridX = refBlock.gridX + offset.x;
          gridZ = refBlock.gridZ + offset.z;
        }

        // 物理合法性：目標格有無懸空
        const stackY = this.game.stackYAt(gridX, gridZ, held);

        this.ui.setCommand(`📦 放到 (${gridX}, ${gridZ})…`, 'ai-processing');
        await this.arm.place(gridX, gridZ, stackY, this.game.blocks);

        this.ui.setCommand('✅ 放好了！', 'success');
        this.ui.refreshBlockList(this.game.blocks);

        // 勝負判定
        const { done, layersDone } = this.game.checkWin();
        this.ui.updateProgress(layersDone, this.game.totalLayers);
        if (done) {
          await this.ui.onWin();
        } else if (layersDone > this.game._prevLayersDone) {
          this.game._prevLayersDone = layersDone;
          await this.ui.onLayerDone(layersDone, this.game.totalLayers);
        }

        this.game.failCount = 0;
        break;
      }

      default:
        this._fail('不認識的指令：' + action);
    }
  }

  // ── 錯誤：累計失敗次數 ───────────────────
  _fail(msg) {
    this.ui.setCommand('❌ ' + msg, 'error');
    this._incrementFail();
  }

  _incrementFail() {
    this.game.failCount++;
    if (this.game.failCount >= MAX_FAILS) {
      this.game.failCount = 0;
      const hint = this.game.showGhostForTarget();
      if (hint) {
        const colorName = COLORS[hint.block.color].name;
        const phrase = `把${colorName}${hint.block.id}號放到正確位置`;
        this.ui.showGhostHint(phrase);
      }
    }
  }

  // ── 工具方法 ─────────────────────────────
  _resolveBlock({ color, id }) {
    return this.game.findBlock(color, id) ?? null;
  }

  _blockName({ color, id }) {
    const c = color ? (COLORS[color]?.name ?? color) : '?';
    return `${c}${id}號`;
  }

  /** relativePos → gridX/gridZ 偏移 */
  _posOffset(pos) {
    const map = {
      above: { x: 0, z: 0 },
      front: { x: 0, z: 1 },
      back:  { x: 0, z: -1 },
      right: { x: 1, z: 0 },
      left:  { x: -1, z: 0 },
    };
    return map[pos] ?? { x: 0, z: 0 };
  }
}
