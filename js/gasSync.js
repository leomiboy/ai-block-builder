// ──────────────────────────────────────────────
//  gasSync.js  —  Google Apps Script 進度同步
// ──────────────────────────────────────────────
import { GAS_URL } from './config.js';

/**
 * 儲存通關記錄
 * @param {object} data - { playerName, levelName, difficulty, commandLog, completedAt }
 */
export async function saveProgress(data) {
  if (!GAS_URL || GAS_URL.startsWith('YOUR_')) {
    console.warn('[GAS] URL 未設定，跳過儲存');
    return;
  }
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode:   'no-cors',   // GAS CORS 限制，no-cors 仍能送出
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        completedAt: data.completedAt ?? new Date().toISOString(),
      }),
    });
    console.log('[GAS] 記錄已送出');
  } catch (err) {
    console.warn('[GAS] 送出失敗：', err);
  }
}

/**
 * 讀取玩家進度（GET）
 * @param {string} playerName
 */
export async function loadProgress(playerName) {
  if (!GAS_URL || GAS_URL.startsWith('YOUR_')) return null;
  try {
    const res = await fetch(`${GAS_URL}?player=${encodeURIComponent(playerName)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[GAS] 讀取失敗：', err);
    return null;
  }
}
