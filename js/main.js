// ──────────────────────────────────────────────
//  main.js  —  入口點，串接所有模組
// ──────────────────────────────────────────────
import { LEVELS, COLORS } from './config.js';
import { initScene }      from './scene.js';
import { Arm }            from './arm.js';
import { GameLogic }      from './gameLogic.js';
import { CommandRunner }  from './commandRunner.js';
import { parseCommand }   from './geminiParser.js';
import {
  initVoice, startListening, stopListening, isSupported,
} from './voiceInput.js';
import {
  setCommand, updateProgress, refreshBlockList, setMicState,
  showLayerCelebrate, showGhostHint, drawTargetThumbnail,
  drawCertificate, showScreen,
} from './ui.js';
import { saveProgress } from './gasSync.js';

// ── 全域狀態 ─────────────────────────────────
let sceneCtx, arm, game, runner;
let playerName   = 'AI 指揮官';
let difficulty   = 'tutorial';
let currentLevel = 0;
let commandLog   = [];   // 通關後顯示在證書上

// ── 歡迎畫面事件 ─────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
  });
});

document.getElementById('start-btn').addEventListener('click', () => {
  const nameInput = document.getElementById('player-name').value.trim();
  playerName = nameInput || 'AI 指揮官';

  if (!isSupported()) {
    alert('你的瀏覽器不支援語音辨識，請使用 Chrome！');
    return;
  }

  showScreen('screen-game');
  initGame();
});

// ── 初始化遊戲 ───────────────────────────────
function initGame() {
  commandLog   = [];
  currentLevel = 0;

  // 初始化 Three.js 場景
  if (!sceneCtx) {
    sceneCtx = initScene('canvas-container');
  }

  // 取得難度對應的關卡
  const levels = LEVELS.filter(l => l.difficulty === difficulty);
  if (levels.length === 0) {
    // fallback: 新手關
    loadLevel(LEVELS[0]);
  } else {
    loadLevel(levels[0]);
  }

  // 初始化語音
  initVoice({
    onStart:  () => setMicState(true),
    onResult: handleVoiceResult,
    onEnd:    () => setMicState(false),
  });

  // 麥克風按鈕 — Toggle 模式（點一下開始，偵測到靜音後自動停止）
  const micBtn = document.getElementById('mic-btn');
  micBtn.addEventListener('click', () => {
    // 用 voiceInput 的 isRecording 狀態判斷
    if (document.getElementById('mic-btn').classList.contains('recording')) {
      stopListening();
    } else {
      startListening();
    }
  });

  // HUD 按鈕
  document.getElementById('xray-btn').addEventListener('click', toggleXRay);
  document.getElementById('undo-btn').addEventListener('click', () => {
    if (runner) runner.run({ action: 'undo' });
  });
  document.getElementById('menu-btn').addEventListener('click', () => {
    showScreen('screen-welcome');
  });

  // 勝利畫面按鈕
  document.getElementById('play-again').addEventListener('click', () => {
    showScreen('screen-game');
    initGame();
  });
  document.getElementById('download-cert').addEventListener('click', downloadCert);
}

// ── 載入關卡 ─────────────────────────────────
function loadLevel(levelDef) {
  // 重建 game / arm / runner（首次或重載）
  if (!game) {
    game = new GameLogic(sceneCtx.scene);
  }
  if (!arm) {
    arm = new Arm(sceneCtx.scene);
  }

  game._prevLayersDone = 0;

  const uiBridge = {
    setCommand,
    setStatus:      setCommand,
    refreshBlockList: refreshBlockList,
    showGhostHint,
    updateProgress,
    onLayerDone: async (done, total) => {
      await showLayerCelebrate(done, total);
    },
    onWin: async () => {
      await onWin(levelDef);
    },
  };

  runner = new CommandRunner(arm, game, uiBridge);

  game.loadLevel(levelDef, difficulty);
  updateProgress(0, levelDef.layers);
  refreshBlockList(game.blocks);
  setCommand(`第 ${LEVELS.indexOf(levelDef) + 1} 關：${levelDef.name}`, 'success');

  // 目標縮圖
  try { drawTargetThumbnail(levelDef); } catch (e) { console.error('[Thumbnail error]', e); }

  // 關卡提示（難度對應說明）
  document.getElementById('level-num').textContent = LEVELS.indexOf(levelDef) + 1;
}

// ── 語音結果處理 ─────────────────────────────
async function handleVoiceResult(text) {
  setMicState(false);
  setCommand(`「${text}」`, 'ai-processing');

  commandLog.push(text);

  const blockInfoList = game.getBlockInfoList();
  const cmd = await parseCommand(text, blockInfoList, difficulty);

  await runner.run(cmd);
}

// ── X-Ray 模式 ───────────────────────────────
let _xray = false;
function toggleXRay() {
  _xray = !_xray;
  document.getElementById('xray-btn').classList.toggle('active', _xray);
  game.blocks.forEach(b => b.setXRay(_xray));
}

// ── 通關處理 ─────────────────────────────────
async function onWin(levelDef) {
  // 儲存到 GAS
  await saveProgress({
    playerName,
    levelName:   levelDef.name,
    difficulty,
    commandLog:  commandLog.slice(-20).join('\n'),
    completedAt: new Date().toISOString(),
  });

  // 顯示勝利畫面
  showScreen('screen-win');
  document.getElementById('win-title').textContent    = '🎉 通關！';
  document.getElementById('win-subtitle').textContent = `${playerName}，你完成了「${levelDef.name}」！`;

  const certCanvas = document.getElementById('certificate-canvas');
  drawCertificate(certCanvas, playerName, levelDef.name, commandLog);
}

// ── 下載證書 ─────────────────────────────────
function downloadCert() {
  const canvas = document.getElementById('certificate-canvas');
  const link   = document.createElement('a');
  link.download = `AI積木師_${playerName}_證書.png`;
  link.href     = canvas.toDataURL('image/png');
  link.click();
}
