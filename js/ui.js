// ──────────────────────────────────────────────
//  ui.js  —  DOM HUD 更新、慶祝動畫、證書生成
// ──────────────────────────────────────────────
import { COLORS } from './config.js';

// ── DOM 節點快取 ──────────────────────────────
const $ = id => document.getElementById(id);

// ── 指令顯示區 ───────────────────────────────
const STATUS_CLASSES = ['listening', 'ai-processing', 'success', 'error', 'clarify'];

export function setCommand(text, status = '') {
  const el = $('command-display');
  const txt = $('command-text');
  const ico = $('command-icon');

  STATUS_CLASSES.forEach(c => el.classList.remove(c));
  if (status) el.classList.add(status);

  const icons = {
    listening:     '🎙️',
    'ai-processing': '🤖',
    success:       '✅',
    error:         '❌',
    clarify:       '🤔',
  };
  ico.textContent = icons[status] ?? '💬';
  txt.textContent = text;
}

// ── 進度條 ──────────────────────────────────
export function updateProgress(done, total) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  $('progress-fill').style.width = pct + '%';
  $('progress-text').textContent = `${done} / ${total} 層`;
}

// ── 積木列表面板 ────────────────────────────
export function refreshBlockList(blocks) {
  const list = $('blocks-list');
  list.innerHTML = '';
  blocks.forEach(b => {
    const chip = document.createElement('div');
    chip.className = 'block-chip' + (b.isHeld ? ' grabbed' : '');
    chip.innerHTML = `
      <div class="chip-dot" style="background:${COLORS[b.color].css}"></div>
      <span>${COLORS[b.color].name} ${b.id}號</span>
    `;
    list.appendChild(chip);
  });
}

// ── 麥克風按鈕狀態 ──────────────────────────
export function setMicState(recording) {
  const btn  = $('mic-btn');
  const icon = $('mic-icon');
  const wave = $('sound-wave');
  const hint = $('mic-hint');

  if (recording) {
    btn.classList.add('recording');
    icon.classList.add('hidden');
    wave.classList.remove('hidden');
    hint.textContent = '聆聽中…';
    setCommand('正在聽你說話…', 'listening');
  } else {
    btn.classList.remove('recording');
    icon.classList.remove('hidden');
    wave.classList.add('hidden');
    hint.textContent = '按住說話';
  }
}

// ── 分層慶祝動畫 ────────────────────────────
const LAYER_LINES = [
  '底座超穩固！繼續！🧱',
  '中間層完成！快到了！💪',
  '最高層成功！太厲害了！🌟',
  '超棒的！繼續加油！🎊',
];

export function showLayerCelebrate(layersDone, total) {
  return new Promise(resolve => {
    const overlay  = $('layer-celebrate');
    const emoji    = $('celebrate-emoji');
    const text     = $('celebrate-text');
    const sub      = $('celebrate-sub');

    emoji.textContent = ['🎉', '⭐', '🎆', '🏅'][Math.min(layersDone - 1, 3)];
    text.textContent  = '太棒了！';
    sub.textContent   = LAYER_LINES[Math.min(layersDone - 1, LAYER_LINES.length - 1)];

    overlay.classList.remove('hidden');

    // 自動隱藏
    setTimeout(() => {
      overlay.classList.add('hidden');
      resolve();
    }, 2200);
  });
}

// ── Ghost Block 提示橫幅 ────────────────────
let _ghostTimer = null;
export function showGhostHint(phrase) {
  const banner = $('ghost-hint-banner');
  const phraseEl = $('hint-phrase');
  phraseEl.textContent = `「${phrase}」`;
  banner.classList.remove('hidden');

  clearTimeout(_ghostTimer);
  _ghostTimer = setTimeout(() => banner.classList.add('hidden'), 5000);
}

// ── 目標縮圖（Canvas 示意圖） ───────────────
export function drawTargetThumbnail(levelDef) {
  const canvas = $('target-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const ISO_X = 0.866;
  const ISO_Y = 0.5;
  const SCALE = 12;
  const OX = W / 2, OY = H * 0.75;

  function isoProject(gx, gy, gz) {
    return {
      x: OX + (gx - gz) * ISO_X * SCALE,
      y: OY - gy * SCALE - (gx + gz) * ISO_Y * SCALE,
    };
  }

  function drawBlock(gx, gy, gz, w, h, d, colorHex) {
    const hexStr = '#' + colorHex.toString(16).padStart(6, '0');
    const p = (dx, dy, dz) => isoProject(gx + dx, gy + dy, gz + dz);

    const faces = [
      // 右前面（x = x0+w），中等亮度
      { pts: [p(w,0,0), p(w,h,0), p(w,h,d), p(w,0,d)], light: -20 },
      // 左前面（z = 0），最暗
      { pts: [p(0,0,0), p(w,0,0), p(w,h,0), p(0,h,0)], light: -40 },
      // 頂面（y = y0+h），最亮，最後畫避免被蓋住
      { pts: [p(0,h,0), p(w,h,0), p(w,h,d), p(0,h,d)], light: 35 },
    ];

    faces.forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f.pts[0].x, f.pts[0].y);
      f.pts.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.closePath();
      ctx.fillStyle = shadeColor(hexStr, f.light);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
  }

  // 格子間距（與 3D 場景一致，但縮圖用較小的 GRID）
  const GRID = 4;
  const stackMap = {};

  for (const t of levelDef.target) {
    const key = `${t.gridX},${t.gridZ}`;
    if (!stackMap[key]) stackMap[key] = 0;

    const [bw, bh, bd] = getDims(t.state);
    // 直接傳遊戲原始單位，isoProject 的 SCALE 負責縮放到像素
    drawBlock(
      t.gridX * GRID,   // 格子轉世界 X
      stackMap[key],    // 堆疊 Y（遊戲單位）
      t.gridZ * GRID,   // 格子轉世界 Z
      bw, bh, bd,       // 積木尺寸（原始單位，不除以任何值）
      COLORS[t.color].hex,
    );
    stackMap[key] += bh;
  }
}

function getDims(state) {
  // inline 避免 circular import
  const FACE = { a: 3, b: 2, c: 1 };
  const STATES = [
    [FACE.c, FACE.a, FACE.b], [FACE.b, FACE.a, FACE.c],
    [FACE.c, FACE.b, FACE.a], [FACE.a, FACE.b, FACE.c],
    [FACE.b, FACE.c, FACE.a], [FACE.a, FACE.c, FACE.b],
  ];
  return STATES[state - 1];
}

function shadeColor(hex, pct) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + pct));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
  const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
  return `rgb(${r},${g},${b})`;
}

// ── 電子證書生成 ─────────────────────────────
export function drawCertificate(canvas, playerName, levelName, commandLog) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // 背景漸層
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1a1040');
  grad.addColorStop(1, '#0d0c2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 邊框
  ctx.strokeStyle = '#6c63ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.strokeStyle = 'rgba(108,99,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  // 標題
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆 AI 積木建築師 通關證書', W / 2, 55);

  // 分隔線
  ctx.strokeStyle = 'rgba(108,99,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 70); ctx.lineTo(W - 40, 70); ctx.stroke();

  // 玩家名稱
  ctx.fillStyle = '#00d4ff';
  ctx.font = 'bold 36px Nunito, sans-serif';
  ctx.fillText(playerName, W / 2, 115);

  ctx.fillStyle = '#aabbdd';
  ctx.font = '16px Nunito, sans-serif';
  ctx.fillText('成功完成關卡：' + levelName, W / 2, 145);

  // 指令記錄
  ctx.textAlign = 'left';
  ctx.fillStyle = '#778899';
  ctx.font = 'bold 12px Nunito, sans-serif';
  ctx.fillText('指令記錄', 40, 178);

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(36, 186, W - 72, 100);
  ctx.fillStyle = '#8899cc';
  ctx.font = '12px Nunito, monospace';

  commandLog.slice(-6).forEach((cmd, i) => {
    ctx.fillText(`▶ ${cmd}`, 46, 204 + i * 16);
  });

  // 日期
  ctx.textAlign = 'center';
  ctx.fillStyle = '#556688';
  ctx.font = '13px Nunito, sans-serif';
  const now = new Date();
  ctx.fillText(`${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}`, W / 2, 318);

  // 底部印章
  ctx.fillStyle = 'rgba(108,99,255,0.2)';
  ctx.beginPath(); ctx.arc(W / 2, 345, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#aaaaff';
  ctx.font = '24px serif';
  ctx.fillText('✔', W / 2, 355);
}

// ── 畫面切換 ────────────────────────────────
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
