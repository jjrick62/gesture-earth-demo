import { Earth } from './earth.js';
import { initCamera, stopCamera, getFPS, isFPSLow, CameraError } from './camera.js';
import { classify } from './classifier.js';
import { initMapper, applyGesture, getSensitivity, adjustSensitivity, resetSensitivity } from './mapper.js';
import * as UI from './ui.js';
import { MAP_FILES } from './constants.js';

let earth = null;
let _running = false;
let _frameCount = 0;

// ===== 全局错误处理 =====
function handleError(err, severity) {
  console.error(`[${severity}]`, err);
  const msg = err instanceof CameraError ? err.message : (err.message || String(err));

  if (severity === 'fatal') {
    _running = false;
    UI.hideLoading();
    UI.showError(msg, 'fatal');
    document.getElementById('loading-overlay').innerHTML =
      `<div style="text-align:center"><p style="color:#e55;font-size:1.2rem">${msg}</p><button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;background:#333;color:#fff;border:1px solid #555;border-radius:0.25rem;cursor:pointer">刷新重试</button></div>`;
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-overlay').style.opacity = '1';
  } else if (severity === 'warn') {
    UI.showError(msg, 'warn');
  }
}

// ===== 主循环 =====
function loop() {
  if (!_running) return;

  _frameCount++;
  // 每 5 帧更新 UI（不逐帧刷新 DOM）
  if (_frameCount % 5 === 0) {
    const fps = getFPS();
    UI.updateFPS(fps);

    if (isFPSLow()) {
      UI.showError('帧率偏低，尝试降低光照或减少手势移动幅度', 'warn');
    }
  }

  requestAnimationFrame(loop);
}

// ===== 手势帧回调 =====
let _debugFrame = 0;
let _debugPrinted = false;
function onGestureFrame(landmarks) {
  if (!_running) return;

  _debugFrame++;
  const result = classify(landmarks);
  if (!_debugPrinted && landmarks && landmarks.length > 0) {
    _debugPrinted = true;
    // 分类器依赖的核心关键点
    const core = [0,4,8,9]; // 腕、拇指尖、食指尖、掌心(MCP9)
    for (const i of core) {
      console.log(`[debug] pt[${i}]: x=${landmarks[i].x.toFixed(4)} y=${landmarks[i].y.toFixed(4)} z=${(landmarks[i].z||0).toFixed(4)} vis=${landmarks[i].visibility?.toFixed(4)}`);
    }
    // 手动算一下拇指尖-食指尖距离
    const d = Math.sqrt((landmarks[4].x-landmarks[8].x)**2 + (landmarks[4].y-landmarks[8].y)**2);
    console.log('[debug] 拇指-食指距离:', d.toFixed(4), '阈值:', 0.20);
    console.log('[debug] classify结果:', result);
  }
  if (_debugFrame % 60 === 0) {
    console.log('[gesture]', result.gesture, 'conf:', result.confidence?.toFixed(2), 'pts:', landmarks?.length || 0);
  }
  const state = applyGesture(result);
  if (state) {
    UI.updateGesture(state);
    if (state.sensitivity) {
      UI.updateSensitivity(state.sensitivity);
    }
  }
}

// ===== 初始化 =====
async function init() {
  UI.showLoading();

  // 1. 初始化地球
  try {
    const container = document.getElementById('globe-container');
    earth = new Earth(container);
    // 初始化视角
    const aspect = window.innerWidth / window.innerHeight;
    const t = Math.max(0, Math.min(1, (1.6 - aspect) / 1.2));
    earth.camera.position.set(0, 1.5 + t * 2.0, 3.5 + t * 2.0);
    earth.start();

    // 加载海岸线（仅海岸线和国界）
    earth.loadCoastlines().catch(err => handleError(err, 'warn'));
    earth.loadAdminBoundaries().catch(err => console.warn('Admin load:', err));
  } catch (err) {
    handleError(err, 'fatal');
    return;
  }

  // 2. 初始化手势映射器
  initMapper(earth);

  // 3. 初始化摄像头 + MediaPipe
  try {
    await initCamera(onGestureFrame);
    UI.updateCameraStatus(true);
    UI.showHint();
  } catch (err) {
    if (err instanceof CameraError && err.code === 'CAMERA_DENIED') {
      handleError(err, 'warn');
      UI.updateCameraStatus(false);
      // 切键鼠模式：保持现有 OrbitControls 可用，隐藏手势 UI
      document.getElementById('gesture-status').textContent = '— 键鼠模式';
      document.getElementById('gesture-action').textContent = '拖拽旋转 · 滚轮缩放 · 空格自转';
      document.getElementById('gesture-hint').style.display = 'none';
    } else {
      handleError(err, 'fatal');
      return;
    }
  }

  // 4. 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      UI.updateSensitivity(adjustSensitivity(1));
    } else if (e.key === '-') {
      e.preventDefault();
      UI.updateSensitivity(adjustSensitivity(-1));
    } else if (e.key === 'r' || e.key === 'R') {
      UI.updateSensitivity(resetSensitivity());
    }
  });

  // 5. 上线
  UI.hideLoading();
  _running = true;
  requestAnimationFrame(loop);
}

init();
