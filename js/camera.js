import { CAMERA_VIDEO, FPS_WARN_THRESHOLD, FPS_SAMPLE_WINDOW } from './constants.js';

let _video = null;
let _hands = null;
let _stream = null;
let _onFrame = null;
let _fpsSamples = [];
let _canvas = null;
let _ctx = null;

const VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12';

export function getVideo() { return _video; }
export function hasCamera() { return !!_stream; }

export async function initCamera(onFrameCallback) {
  _onFrame = onFrameCallback;
  console.log('[camera] 开始初始化...');

  // 1. 打开摄像头
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: CAMERA_VIDEO.WIDTH }, height: { ideal: CAMERA_VIDEO.HEIGHT }, facingMode: 'user' },
      audio: false,
    });
    console.log('[camera] 摄像头流已获取');
  } catch (err) {
    console.error('[camera] getUserMedia 失败:', err.name, err.message);
    if (err.name === 'NotAllowedError') throw new CameraError('CAMERA_DENIED', '摄像头权限被拒绝');
    if (err.name === 'NotFoundError') throw new CameraError('CAMERA_DENIED', '未检测到摄像头设备');
    throw new CameraError('CAMERA_DENIED', '摄像头不可用');
  }

  // 2. 隐藏视频元素（给 MediaPipe 喂帧用）
  _video = document.createElement('video');
  _video.srcObject = _stream;
  _video.muted = true;
  _video.playsInline = true;
  _video.style.display = 'none';
  document.body.appendChild(_video);
  await _video.play();
  console.log('[camera] 视频播放就绪');

  // 3. 摄像头预览小窗
  const camWin = document.getElementById('camera-window');
  if (camWin) {
    camWin.srcObject = _stream;
    camWin.muted = true;
    camWin.playsInline = true;
    camWin.style.borderColor = '#3a3';
    camWin.play().catch(() => {});
  }

  // 4. 骨架画布覆盖层
  _canvas = document.createElement('canvas');
  _canvas.id = 'gesture-canvas';
  _canvas.width = CAMERA_VIDEO.WIDTH;
  _canvas.height = CAMERA_VIDEO.HEIGHT;
  _canvas.style.cssText = 'position:fixed;bottom:1rem;left:1rem;width:160px;height:120px;z-index:101;pointer-events:none';
  document.body.appendChild(_canvas);
  _ctx = _canvas.getContext('2d');

  // 5. 加载新版 MediaPipe Vision Tasks API
  console.log('[camera] 加载 MediaPipe Tasks Vision...');
  const { FilesetResolver, HandLandmarker } = await import(
    VISION_BASE + '/vision_bundle.mjs'
  );

  // 6. 初始化 WASM
  const wasmFileset = await FilesetResolver.forVisionTasks(VISION_BASE + '/wasm');

  // 7. 创建 HandLandmarker
  // 模型文件在 Google 官方存储，jsdelivr 上没有
  _hands = await HandLandmarker.createFromOptions(wasmFileset, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });
  console.log('[camera] HandLandmarker 初始化完成');

  // 8. 启动帧捕获
  console.log('[camera] 启动帧捕获');
  captureFrame();
}

// 手部关键点连线（MediaPipe 标准 21 点）
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

let _frameSeq = 0;

function onHandsResults(result) {
  _frameSeq++;
  if (_frameSeq === 1) console.log('[camera] 收到第一帧识别结果');

  const landmarks = result.landmarks?.[0] || null;

  // 绘制手势骨架线
  drawSkeleton(landmarks);

  // 回调给分类器
  if (_onFrame) _onFrame(landmarks);

  _fpsSamples.push(performance.now());
  if (_fpsSamples.length > FPS_SAMPLE_WINDOW) _fpsSamples.shift();
}

function drawSkeleton(landmarks) {
  if (!_ctx) return;
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  if (!landmarks || landmarks.length === 0) return;

  const w = _canvas.width, h = _canvas.height;

  // 连线
  _ctx.strokeStyle = 'rgba(0,255,100,0.7)';
  _ctx.lineWidth = 2;
  for (const [i, j] of CONNECTIONS) {
    _ctx.beginPath();
    _ctx.moveTo(landmarks[i].x * w, landmarks[i].y * h);
    _ctx.lineTo(landmarks[j].x * w, landmarks[j].y * h);
    _ctx.stroke();
  }

  // 关键点
  for (let i = 0; i < landmarks.length; i++) {
    const x = landmarks[i].x * w, y = landmarks[i].y * h;
    _ctx.fillStyle = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20) ? 'rgba(0,255,200,1)' : 'rgba(0,255,100,0.8)';
    _ctx.beginPath();
    _ctx.arc(x, y, i === 0 ? 4 : 2.5, 0, Math.PI * 2);
    _ctx.fill();
  }
}

export function getFPS() {
  if (_fpsSamples.length < 2) return 0;
  const span = _fpsSamples[_fpsSamples.length - 1] - _fpsSamples[0];
  return span > 0 ? Math.round((_fpsSamples.length - 1) / (span / 1000)) : 0;
}

export function isFPSLow() {
  return getFPS() > 0 && getFPS() < FPS_WARN_THRESHOLD;
}

function captureFrame() {
  if (!_video || !_hands) return;
  const now = performance.now();
  const result = _hands.detectForVideo(_video, now);
  onHandsResults(result);
  setTimeout(() => requestAnimationFrame(captureFrame), 1000 / CAMERA_VIDEO.FPS);
}

export function stopCamera() {
  console.log('[camera] 停止摄像头');
  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
  if (_video) { _video.pause(); _video.remove(); _video = null; }
  if (_canvas) { _canvas.remove(); _canvas = null; }
  _ctx = null;
  _hands = null;
}

export class CameraError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'CameraError';
  }
}
