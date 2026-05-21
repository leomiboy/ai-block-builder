// ──────────────────────────────────────────────
//  voiceInput.js  —  Web Speech API Push-to-Talk
// ──────────────────────────────────────────────

let recognition = null;
let _onResult   = null;  // callback(text: string)
let _onStart    = null;
let _onEnd      = null;
let _isRecording = false;

export function initVoice({ onResult, onStart, onEnd }) {
  _onResult = onResult;
  _onStart  = onStart;
  _onEnd    = onEnd;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('[Voice] Web Speech API 不支援，需要 Chrome 瀏覽器');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.lang           = 'zh-TW';
  recognition.continuous     = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    _isRecording = true;
    console.log('[Voice] 🎙️ 開始錄音');
    if (_onStart) _onStart();
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.trim();
    console.log('[Voice] ✅ 辨識結果：', text);
    if (_onResult) _onResult(text);
  };

  recognition.onerror = (event) => {
    console.warn('[Voice] ❌ 錯誤：', event.error);
    _isRecording = false;
    if (_onEnd) _onEnd(null);
  };

  recognition.onend = () => {
    console.log('[Voice] 🔚 錄音結束');
    _isRecording = false;
    if (_onEnd) _onEnd();
  };

  return true;
}

export function startListening() {
  console.log('[Voice] startListening() called, _isRecording=', _isRecording);
  if (!recognition || _isRecording) return;
  try {
    recognition.start();
  } catch (e) {
    console.warn('[Voice] start() 失敗：', e);
  }
}

export function stopListening() {
  console.log('[Voice] stopListening() called, _isRecording=', _isRecording);
  if (!recognition || !_isRecording) return;
  recognition.stop();
}

export function isSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
