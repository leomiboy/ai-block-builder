// ──────────────────────────────────────────────
//  geminiParser.js  —  Gemini API 語音指令解析
//  語音文字 → 結構化 JSON 指令
// ──────────────────────────────────────────────
import { GEMINI_API_KEY, GEMINI_MODEL } from './config.js';

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * 建立系統 Prompt
 * @param {object[]} availableBlocks - 場上積木清單
 * @param {string}   difficulty
 */
function buildPrompt(voiceText, availableBlocks, difficulty) {
  const blockList = availableBlocks
    .map(b => `${b.colorName}${b.id}號（現在狀態：${b.state}，${b.isHeld ? '手持中' : b.isPlaced ? '已放置' : '候選區'}）`)
    .join('、');

  const diffHint = {
    tutorial: '新手模式：指令非常簡單，通常只含一個動作。',
    easy:     '初階模式：一句話只含一個動作。',
    medium:   '中階模式：一句話可能包含完整的拿起+調整+放置指令。',
  }[difficulty] || '';

  return `你是一個積木遊戲的 AI 指令解析器。使用者是 6 歲兒童，語音可能不精準或說得很短。

${diffHint}

場上積木：${blockList || '（無）'}

請將以下兒童語音解析為 JSON 指令物件，格式嚴格如下（回應只能是純 JSON，不得有多餘文字）：

{
  "action": "grab" | "rotate" | "layFlat" | "sideDown" | "standUp" | "place" | "undo" | "unknown",
  "target": { "color": "red|yellow|blue|green", "id": 1 },
  "gridX": 0,
  "gridZ": 0,
  "relativeTo": { "color": "red|yellow|blue|green", "id": 1 } | null,
  "relativePos": "above" | "front" | "back" | "left" | "right" | null,
  "needClarify": true | false,
  "clarifyQuestion": "（若 needClarify=true，這裡填追問句子）",
  "errorMsg": "（若 action=unknown，填錯誤原因）"
}

欄位說明：
- action: grab=拿起, rotate=轉90度, layFlat=躺平, sideDown=側躺, standUp=站立, place=放置, undo=時光倒流, unknown=無法解析
- target: grab 必填；place 若需要也填
- gridX/gridZ: place 時，若說「放在地板上」填 0,0；若說相對位置則留 null
- relativeTo: place 時說「放在＿的上面/旁邊」則填目標積木
- relativePos: above=正上方, front=前方, back=後方, left=左方, right=右方
- needClarify: 語意不足時為 true，填 clarifyQuestion

顏色對照：紅色→red, 黃色→yellow, 藍色→blue, 綠色→green

兒童語音文字：「${voiceText}」`;
}

/**
 * 呼叫 Gemini API 解析語音指令
 * @param {string}   voiceText
 * @param {object[]} availableBlocks - [{ colorName, id, state, isHeld, isPlaced }]
 * @param {string}   difficulty
 * @returns {Promise<object>} parsed command JSON
 */
export async function parseCommand(voiceText, availableBlocks, difficulty) {
  const prompt = buildPrompt(voiceText, availableBlocks, difficulty);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Gemini] HTTP error', res.status, errBody);
      return { action: 'unknown', needClarify: false, errorMsg: `API 錯誤 ${res.status}` };
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // 安全解析 JSON（有時 Gemini 會包 ```json … ``` fences）
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed  = JSON.parse(cleaned);

    console.log('[Gemini] 解析結果：', parsed);
    return parsed;
  } catch (err) {
    console.error('[Gemini] 解析失敗：', err);
    return { action: 'unknown', needClarify: false, errorMsg: '解析失敗，請再試一次' };
  }
}
