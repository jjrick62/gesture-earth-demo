import { GESTURE_NONE } from './classifier.js';
import { HINT_HIDE_DELAY } from './constants.js';

const GESTURE_LABELS = {
  open_palm:  '🖐 张开手掌',
  pinch:      '🤏 拇指食指捏合',
  fist:       '✊ 握拳',
  index_point: '☝ 单食指指向',
  none:       '— 未检测到手势',
};

let _hintTimer = null;
let _hidden = false;

export function showLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'flex';
}

export function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 300); }
}

export function updateGesture(state) {
  if (!state) return;
  const nameEl = document.getElementById('gesture-status');
  const actionEl = document.getElementById('gesture-action');
  if (nameEl) nameEl.textContent = GESTURE_LABELS[state.gesture] || GESTURE_LABELS.none;
  if (actionEl) actionEl.textContent = state.action || '';

  // 首次识别到有效手势 → 隐藏提示
  if (state.gesture !== GESTURE_NONE && !_hidden) {
    hideHint();
  }
}

export function updateFPS(fps) {
  const el = document.getElementById('fps-display');
  if (el) {
    el.textContent = fps > 0 ? `${fps}fps` : '—';
    el.style.color = fps > 0 && fps < 10 ? '#e55' : '#666';
  }
}

export function updateSensitivity(sensitivity) {
  const el = document.getElementById('sensitivity-display');
  if (el) {
    el.textContent = `灵敏度 R:${sensitivity.rotate.toFixed(2)} Z:${sensitivity.zoom.toFixed(2)}`;
  }
}

export function updateCameraStatus(active) {
  const el = document.getElementById('camera-indicator');
  if (el) {
    el.textContent = active ? '🟢 摄像头活跃' : '🔴 摄像头未激活';
    el.style.color = active ? '#0a0' : '#e55';
  }
}

export function showHint() {
  // 初始显示，不自动隐藏（等首次手势触发）
  _hidden = false;
  const el = document.getElementById('gesture-hint');
  if (el) { el.style.opacity = '1'; el.style.display = ''; }
}

export function hideHint() {
  _hidden = true;
  const el = document.getElementById('gesture-hint');
  if (!el) return;
  el.style.opacity = '0';
  clearTimeout(_hintTimer);
  _hintTimer = setTimeout(() => { el.style.display = 'none'; }, 600);
}

export function showError(msg, severity = 'warn') {
  const el = document.getElementById('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
  el.style.color = severity === 'fatal' ? '#e55' : '#cc0';
  if (severity === 'warn') {
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
}

export function hideError() {
  const el = document.getElementById('error-msg');
  if (el) el.style.display = 'none';
}
