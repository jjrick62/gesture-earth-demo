import { GESTURE, SENSITIVITY } from './constants.js';
import { GESTURE_NONE, GESTURE_OPEN_PALM, GESTURE_PINCH, GESTURE_FIST, GESTURE_INDEX_POINT } from './classifier.js';

let _currentGesture = GESTURE_NONE;
let _gestureFrameCount = 0;
let _lastPalmPos = null;
let _earth = null;
let _state = { rotate: SENSITIVITY.ROTATE, zoom: SENSITIVITY.ZOOM };

// 标记 sprite
let _markerSprite = null;

export function initMapper(earthInstance) {
  _earth = earthInstance;
  loadSensitivity();
}

export function getSensitivity() { return { ..._state }; }

export function adjustSensitivity(delta) {
  _state.rotate = clamp(_state.rotate + delta * SENSITIVITY.STEP * SENSITIVITY.ROTATE, SENSITIVITY.ROTATE * SENSITIVITY.MIN, SENSITIVITY.ROTATE * SENSITIVITY.MAX);
  _state.zoom = clamp(_state.zoom + delta * SENSITIVITY.STEP * SENSITIVITY.ZOOM, SENSITIVITY.ZOOM * SENSITIVITY.MIN, SENSITIVITY.ZOOM * SENSITIVITY.MAX);
  saveSensitivity();
  return { ..._state };
}

export function resetSensitivity() {
  _state.rotate = SENSITIVITY.ROTATE;
  _state.zoom = SENSITIVITY.ZOOM;
  saveSensitivity();
  return { ..._state };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function saveSensitivity() { try { localStorage.setItem('gesture_earth_sensitivity', JSON.stringify(_state)); } catch {} }
function loadSensitivity() {
  try { const raw = localStorage.getItem('gesture_earth_sensitivity'); if (raw) { const s = JSON.parse(raw); _state.rotate = s.rotate || SENSITIVITY.ROTATE; _state.zoom = s.zoom || SENSITIVITY.ZOOM; } } catch {}
}

// ===== 帮助函数：沿径向缩放摄像机 =====
function zoomCamera(targetDist) {
  const minCam = _earth.controls.minDistance || 1.7;
  const maxCam = _earth.controls.maxDistance || 6.0;
  const cam = _earth.camera.position;
  const cur = cam.length();
  const t = clamp(targetDist, minCam, maxCam);
  const s = t / cur;
  cam.x *= s; cam.y *= s; cam.z *= s;
}

function zoomBy(delta) {
  const cam = _earth.camera.position;
  zoomCamera(cam.length() + delta);
}

// ===== 手势结果 → 地球控制 =====
export function applyGesture(result) {
  if (!_earth) return null;

  const { gesture, params } = result;
  const MIN_CAM = _earth.controls.minDistance || 1.7;
  const MAX_CAM = _earth.controls.maxDistance || 6.0;

  // ---- 手势切换防抖 ----
  if (gesture !== _currentGesture) {
    _gestureFrameCount++;
    if (_gestureFrameCount < GESTURE.DEBOUNCE_FRAMES) return { gesture: _currentGesture, transitioning: true };
    _currentGesture = gesture;
    _gestureFrameCount = 0;
    _lastPalmPos = null;
  } else {
    _gestureFrameCount = Math.min(_gestureFrameCount + 1, GESTURE.DEBOUNCE_FRAMES + 1);
  }

  if (!params) {
    _earth.rotating = true;
    return { gesture: GESTURE_NONE };
  }

  let action = '';

  switch (_currentGesture) {
    case GESTURE_OPEN_PALM: {
      _earth.rotating = true;
      action = '旋转地球';
      if (_lastPalmPos) {
        const dx = params.palmCenter.x - _lastPalmPos.x;
        const dy = params.palmCenter.y - _lastPalmPos.y;
        if (Math.abs(dx) > 0.001) {
          _earth.earthGroup.rotation.y += dx * _state.rotate * 8;
        }
        if (Math.abs(dy) > 0.001) {
          const theta = -dy * _state.rotate * 4;
          const cam = _earth.camera.position;
          const dist = cam.length();
          const phi = Math.acos(cam.y / dist) + theta;
          const clampedPhi = clamp(phi, 0.1, Math.PI - 0.1);
          const newY = dist * Math.cos(clampedPhi);
          const r = dist * Math.sin(clampedPhi);
          const azi = Math.atan2(cam.z, cam.x);
          cam.x = r * Math.cos(azi);
          cam.y = newY;
          cam.z = r * Math.sin(azi);
        }
      }
      _lastPalmPos = { ...params.palmCenter };
      break;
    }

    case GESTURE_PINCH: {
      // 捏合程度直接映射缩放：紧贴→最近，松开→最远
      const pinchDist = params.pinchDistance; // 相对距离，0.1(紧)~0.7(松)
      const minCam = _earth.controls.minDistance || 1.7;
      const maxCam = _earth.controls.maxDistance || 6.0;
      // pinchDist 0.15(紧贴)→minCam(拉近), 0.60(松开)→maxCam(拉远)
      const t = clamp((pinchDist - 0.15) / 0.45, 0, 1);
      const target = minCam + t * (maxCam - minCam);
      // 平滑插值到目标距离
      const cur = _earth.camera.position.length();
      zoomCamera(cur + (target - cur) * 0.25);
      action = t < 0.3 ? '🔍 放大' : t > 0.6 ? '🔎 缩小' : '缩放';
      break;
    }

    case GESTURE_FIST: {
      _earth.rotating = false;
      action = '已暂停';
      break;
    }

    case GESTURE_INDEX_POINT: {
      action = '指向位置';
      const tip = params.indexTip;
      if (tip) {
        const ndcX = (1 - tip.x) * 2 - 1;
        const ndcY = -(tip.y * 2 - 1);
        _earth.mouse.set(ndcX, ndcY);
        _earth.raycaster.setFromCamera(_earth.mouse, _earth.camera);
        _getThree().then(THREE => {
          const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), _earth.earthRadius);
          const intersection = new THREE.Vector3();
          if (_earth.raycaster.ray.intersectSphere(sphere, intersection)) {
            placeMarker(intersection);
          }
        });
      }
      break;
    }
  }

  return { gesture: _currentGesture, action, sensitivity: { ..._state } };
}

// ===== THREE 动态加载 =====
let _THREE = null;
function _getThree() { if (!_THREE) _THREE = import('three'); return _THREE; }

let _markerCreated = false;
function placeMarker(worldPos) {
  _getThree().then(THREE => {
    if (!_markerCreated) {
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      _markerSprite = new THREE.Sprite(mat);
      _markerSprite.scale.setScalar(0.08);
      _earth.earthGroup.add(_markerSprite);
      _markerCreated = true;
    }
    _markerSprite.position.copy(worldPos);
    _markerSprite.material.opacity = 1;
    clearTimeout(_markerSprite._timer);
    _markerSprite._timer = setTimeout(() => { if (_markerSprite) _markerSprite.material.opacity = 0; }, 500);
  });
}
