# AI 機械手臂積木建築師

> 🤖 專為 6 歲兒童設計的 3D 語音互動網頁遊戲  
> 對 AI 機械手臂說話，透過積木堆疊訓練結構化思考與空間認知！

## 🚀 線上試玩
[Netlify 部署後填入 URL]

---

## ⚙️ 使用前設定（必填）

開啟 `js/config.js`，填入：

```js
export const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'; // Gemini API Key
export const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';       // GAS 部署 URL（可選）
```

取得 Gemini API Key：https://aistudio.google.com/app/apikey

---

## 📁 專案結構

```
/
├── index.html
├── style.css
├── js/
│   ├── config.js        ← ★ 填入 API Key
│   ├── main.js          ← 入口
│   ├── scene.js         ← Three.js 場景
│   ├── block.js         ← 積木類別
│   ├── arm.js           ← 機械手臂動畫
│   ├── gameLogic.js     ← 遊戲狀態機
│   ├── voiceInput.js    ← Web Speech API
│   ├── geminiParser.js  ← Gemini 語音解析
│   ├── commandRunner.js ← 指令執行器
│   ├── ui.js            ← HUD / 動畫
│   └── gasSync.js       ← GAS 同步
└── gas/
    └── Code.gs          ← GAS 後端（選用）
```

---

## 🌐 部署到 Netlify

1. 將專案 push 到 GitHub
2. 登入 [Netlify](https://netlify.com) → Add site → Import from GitHub
3. Build command：**留空**（純靜態）
4. Publish directory：`.`（根目錄）
5. Deploy！

---

## 🎮 操作說明

| 動作    | 語音範例                     |
|---------|------------------------------|
| 拿起    | 「拿起紅色1號」              |
| 轉向    | 「轉90度」                   |
| 調整    | 「躺平」「側躺」「站立」      |
| 放置    | 「放在地板上」「放在黃色1號上面」 |
| 後悔    | 「時光倒流」                 |

> ⚠️ **需要使用 Chrome 瀏覽器**（Web Speech API 限定）

---

## 🛠️ GAS 後端設置（選用）

1. 開啟 [Google Apps Script](https://script.google.com)
2. 貼入 `gas/Code.gs` 內容
3. 填入 Google 試算表 ID
4. 部署為 Web App（任何人可存取）
5. 複製 URL 填回 `js/config.js`

---

## 技術棧

- **Three.js 0.165** — 3D 等角透視場景
- **Web Speech API** — 瀏覽器原生語音辨識
- **Gemini 2.0 Flash** — 語意解析，語音 → 結構化 JSON
- **GSAP 3** — 手臂動畫補間
- **GAS + Google Sheets** — 通關記錄儲存
