// ──────────────────────────────────────────────
//  config.js  —  全域常數與關卡定義
// ──────────────────────────────────────────────

// ★ 請填入你的 API Key（前端直接使用，已知曉風險）
export const GEMINI_API_KEY = 'AIzaSyD1deQ4YsSd1owcJxS22kLeta1ZRlAz5Uo';
export const GEMINI_MODEL   = 'gemini-3-flash-preview';

// ★ 請填入 GAS Web App 部署後的 URL
export const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';

// ──────────────────────────────────────────────
// 積木面積比例：a > b > c
// ──────────────────────────────────────────────
export const FACE = { a: 3, b: 2, c: 1 };

// 6 種放置狀態 → [width(X), height(Y), depth(Z)]
// 依據企劃書定義（前=Z, 右=X, 上=Y）
export const BLOCK_STATES = [
  [FACE.c, FACE.a, FACE.b], // 1: a朝下, b朝前, c朝右
  [FACE.b, FACE.a, FACE.c], // 2: a朝下, c朝前, b朝右  (狀態1繞a旋轉90°)
  [FACE.c, FACE.b, FACE.a], // 3: b朝下, a朝前, c朝右
  [FACE.a, FACE.b, FACE.c], // 4: b朝下, c朝前, a朝右  (狀態3繞b旋轉90°)
  [FACE.b, FACE.c, FACE.a], // 5: c朝下, a朝前, b朝右
  [FACE.a, FACE.c, FACE.b], // 6: c朝下, b朝前, a朝右  (狀態5繞c旋轉90°)
];

// 動作指令名稱 → stateIndex 切換規則
// 轉90度：同底面，旋轉（奇↔偶配對）
export const ROTATE_MAP = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5 };
// 躺平（a朝下）：保留原前後方向 group
export const LAY_FLAT_MAP = { 1:1, 2:2, 3:1, 4:2, 5:1, 6:2 };
// 側躺（b朝下）
export const SIDE_DOWN_MAP = { 1:3, 2:4, 3:3, 4:4, 5:3, 6:4 };
// 站立（c朝下）
export const STAND_UP_MAP  = { 1:5, 2:6, 3:5, 4:6, 5:5, 6:6 };

// ──────────────────────────────────────────────
// 顏色定義
// ──────────────────────────────────────────────
export const COLORS = {
  red:    { hex: 0xee4444, name: '紅色', css: '#ee4444' },
  yellow: { hex: 0xffcc00, name: '黃色', css: '#ffcc00' },
  blue:   { hex: 0x4488ff, name: '藍色', css: '#4488ff' },
  green:  { hex: 0x22cc66, name: '綠色', css: '#22cc66' },
};

// 顏色中文名稱反查
export const COLOR_NAME_MAP = {
  '紅色': 'red', '紅': 'red',
  '黃色': 'yellow', '黃': 'yellow',
  '藍色': 'blue', '藍': 'blue',
  '綠色': 'green', '綠': 'green',
};

// ──────────────────────────────────────────────
// 積木物理格子大小（Three.js 單位）
// ──────────────────────────────────────────────
export const CELL = 4;       // 格子間距（比最大積木面 a=3 稍寬）
export const GRID_SIZE = 3;  // 遊戲區 3×3 格

// ──────────────────────────────────────────────
// 失敗三次觸發 Ghost Block
// ──────────────────────────────────────────────
export const MAX_FAILS = 3;

// ──────────────────────────────────────────────
// 關卡定義
// 每個關卡包含：
//   available  → 可使用的積木（給玩家操作的積木初始狀態）
//   target     → 目標排列（最終正確答案）
//   layers     → 分幾層完成（用於進度條）
//   name       → 關卡名稱
//
// target 中每個 block：
//   color, id      → 識別哪一塊積木
//   state          → 目標放置狀態 (1-6)
//   gridX, gridZ   → 在遊戲格子中的位置（整數）
//   onTopOf        → 疊在哪塊積木上面 null=地板
// ──────────────────────────────────────────────
export const LEVELS = [
  // ── 新手訓練營 ──────────────────────────────
  {
    name: '新手訓練營',
    difficulty: 'tutorial',
    layers: 1,
    available: [
      { color: 'red', id: 1, state: 4 },
    ],
    target: [
      { color: 'red', id: 1, state: 4, gridX: 0, gridZ: 0, onTopOf: null },
    ],
    guidedPhrases: [
      '拿起紅色1號',
      '放在地板上',
    ],
  },

  // ── 初階 Level 1 ────────────────────────────
  {
    name: '小小塔樓',
    difficulty: 'easy',
    layers: 2,
    available: [
      { color: 'red',    id: 1, state: 4 },
      { color: 'yellow', id: 1, state: 4 },
    ],
    target: [
      { color: 'red',    id: 1, state: 4, gridX: 0, gridZ: 0, onTopOf: null },
      { color: 'yellow', id: 1, state: 4, gridX: 0, gridZ: 0, onTopOf: { color: 'red', id: 1 } },
    ],
  },

  // ── 初階 Level 2 ────────────────────────────
  {
    name: '積木排排站',
    difficulty: 'easy',
    layers: 1,
    available: [
      { color: 'blue',  id: 1, state: 4 },
      { color: 'green', id: 1, state: 4 },
    ],
    target: [
      { color: 'blue',  id: 1, state: 4, gridX: -1, gridZ: 0, onTopOf: null },
      { color: 'green', id: 1, state: 4, gridX:  1, gridZ: 0, onTopOf: null },
    ],
  },

  // ── 中階 Level 1 ────────────────────────────
  {
    name: '三色金字塔',
    difficulty: 'medium',
    layers: 3,
    available: [
      { color: 'blue',   id: 1, state: 4 },
      { color: 'red',    id: 1, state: 1 },
      { color: 'yellow', id: 1, state: 6 },
    ],
    target: [
      { color: 'blue',   id: 1, state: 4, gridX: 0, gridZ: 0, onTopOf: null },
      { color: 'red',    id: 1, state: 1, gridX: 0, gridZ: 0, onTopOf: { color: 'blue',  id: 1 } },
      { color: 'yellow', id: 1, state: 6, gridX: 0, gridZ: 0, onTopOf: { color: 'red',   id: 1 } },
    ],
  },

  // ── 中階 Level 2 ────────────────────────────
  {
    name: '彩色城堡',
    difficulty: 'medium',
    layers: 2,
    available: [
      { color: 'red',    id: 1, state: 4 },
      { color: 'blue',   id: 1, state: 4 },
      { color: 'yellow', id: 1, state: 1 },
      { color: 'green',  id: 1, state: 1 },
    ],
    target: [
      { color: 'red',    id: 1, state: 4, gridX: -1, gridZ: 0, onTopOf: null },
      { color: 'blue',   id: 1, state: 4, gridX:  1, gridZ: 0, onTopOf: null },
      { color: 'yellow', id: 1, state: 1, gridX: -1, gridZ: 0, onTopOf: { color: 'red',  id: 1 } },
      { color: 'green',  id: 1, state: 1, gridX:  1, gridZ: 0, onTopOf: { color: 'blue', id: 1 } },
    ],
  },
];
