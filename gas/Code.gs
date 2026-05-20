// ──────────────────────────────────────────────
//  Code.gs  —  Google Apps Script 後端
//  功能：接收通關記錄(POST)、回傳玩家進度(GET)
//
//  部署步驟：
//  1. 到 https://script.google.com 建立新專案
//  2. 貼入此程式碼
//  3. 建立一個 Google 試算表，複製試算表 ID 填入 SHEET_ID
//  4. 部署 → 新建部署 → 類型選「網路應用程式」
//     執行身份：我、存取對象：所有人（不用登入）
//  5. 複製部署後的 URL 填入前端 config.js 的 GAS_URL
// ──────────────────────────────────────────────

const SHEET_ID   = 'YOUR_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'Records';

// ── POST：儲存通關記錄 ───────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_NAME);

    // 若工作表不存在則建立並設定標題列
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        '時間戳記', '玩家名稱', '關卡', '難度', '指令記錄'
      ]);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }

    sheet.appendRow([
      data.completedAt ?? new Date().toISOString(),
      data.playerName  ?? '未知',
      data.levelName   ?? '-',
      data.difficulty  ?? '-',
      data.commandLog  ?? '',
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET：讀取玩家歷史記錄 ────────────────────
function doGet(e) {
  try {
    const playerName = e?.parameter?.player ?? '';
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return _json({ records: [] });
    }

    const rows   = sheet.getDataRange().getValues();
    const header = rows[0];
    const data   = rows.slice(1);

    // 依玩家篩選（空字串回傳全部，最多 50 筆）
    const records = data
      .filter(r => !playerName || r[1] === playerName)
      .slice(-50)
      .map(r => ({
        completedAt: r[0],
        playerName:  r[1],
        levelName:   r[2],
        difficulty:  r[3],
        commandLog:  r[4],
      }));

    return _json({ records });

  } catch (err) {
    return _json({ records: [], error: err.message });
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
