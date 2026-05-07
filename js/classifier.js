import { GESTURE } from './constants.js';

// MediaPipe 手部关键点索引
const KP = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

// 手指定义：每根手指的 [指尖, 指根(MCP)]
const FINGERS = [
  { tip: KP.THUMB_TIP,  mcp: KP.THUMB_MCP,  pip: KP.THUMB_IP },   // 拇指
  { tip: KP.INDEX_TIP,  mcp: KP.INDEX_MCP,  pip: KP.INDEX_PIP },    // 食指
  { tip: KP.MIDDLE_TIP, mcp: KP.MIDDLE_MCP, pip: KP.MIDDLE_PIP },   // 中指
  { tip: KP.RING_TIP,   mcp: KP.RING_MCP,   pip: KP.RING_PIP },     // 无名指
  { tip: KP.PINKY_TIP,  mcp: KP.PINKY_MCP,  pip: KP.PINKY_PIP },    // 小指
];

export const GESTURE_NONE = 'none';
export const GESTURE_OPEN_PALM = 'open_palm';
export const GESTURE_PINCH = 'pinch';
export const GESTURE_FIST = 'fist';
export const GESTURE_INDEX_POINT = 'index_point';

// 两点间的归一化距离
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 手指是否伸直：指尖→指根向量 与 指根→腕向量 的余弦相似度
// 伸直时两向量方向一致，余弦接近 1
function isFingerExtended(tip, mcp, wrist) {
  const vecTip = { x: tip.x - mcp.x, y: tip.y - mcp.y, z: (tip.z || 0) - (mcp.z || 0) };
  const vecWrist = { x: wrist.x - mcp.x, y: wrist.y - mcp.y, z: (wrist.z || 0) - (mcp.z || 0) };
  const dot = vecTip.x * vecWrist.x + vecTip.y * vecWrist.y + vecTip.z * vecWrist.z;
  const magTip = Math.sqrt(vecTip.x ** 2 + vecTip.y ** 2 + vecTip.z ** 2);
  const magWrist = Math.sqrt(vecWrist.x ** 2 + vecWrist.y ** 2 + vecWrist.z ** 2);
  if (magTip < 0.001 || magWrist < 0.001) return false;
  return dot / (magTip * magWrist) > GESTURE.FINGER_EXTEND_ANGLE;
}

// 手掌中心 = 掌心(9) 坐标
function palmCenter(landmarks) {
  return { x: landmarks[KP.MIDDLE_MCP].x, y: landmarks[KP.MIDDLE_MCP].y };
}

export function classify(landmarks) {
  // 无手检测
  if (!landmarks || landmarks.length < 21) {
    return { gesture: GESTURE_NONE, params: null, confidence: 0 };
  }

  // HandLandmarker 不提供逐点置信度，跳过门控

  const wrist = landmarks[KP.WRIST];
  const thumbTip = landmarks[KP.THUMB_TIP];
  const indexTip = landmarks[KP.INDEX_TIP];

  // 统计伸直的指数
  let extendedCount = 0;
  let indexExtended = false;
  for (const f of FINGERS) {
    const extended = isFingerExtended(landmarks[f.tip], landmarks[f.mcp], wrist);
    if (extended) {
      extendedCount++;
      if (f.tip === KP.INDEX_TIP) indexExtended = true;
    }
  }

  // 捏合判定：拇指尖与食指尖距离 / 手部尺度（远近不影响）
  const handScale = dist(wrist, landmarks[KP.MIDDLE_MCP]) || 0.01;
  const pinchDist = dist(thumbTip, indexTip) / handScale;

  // 握拳判定：所有指尖到掌心平均距离 / 腕到掌心距离
  const center = palmCenter(landmarks);
  let avgTipToCenter = 0;
  for (const f of FINGERS) {
    avgTipToCenter += dist(landmarks[f.tip], center);
  }
  avgTipToCenter /= FINGERS.length;
  const wristToCenter = dist(wrist, center);
  const gripRatio = wristToCenter > 0.001 ? avgTipToCenter / wristToCenter : 1;

  // 优先级：握拳 > 捏合 > 食指 > 手掌（避免攥拳被误判为捏合）
  if (gripRatio < GESTURE.FIST_GRIP_RATIO) {
    return { gesture: GESTURE_FIST, params: { gripRatio, palmCenter: center }, confidence: 1 - gripRatio / GESTURE.FIST_GRIP_RATIO };
  }

  if (pinchDist < GESTURE.PINCH_DISTANCE) {
    return { gesture: GESTURE_PINCH, params: { pinchDistance: pinchDist, palmCenter: center }, confidence: 1 - pinchDist / GESTURE.PINCH_DISTANCE };
  }

  if (extendedCount === 1 && indexExtended) {
    return { gesture: GESTURE_INDEX_POINT, params: { indexTip }, confidence: 1 };
  }

  if (extendedCount >= GESTURE.EXTENDED_FINGERS_MIN) {
    return { gesture: GESTURE_OPEN_PALM, params: { palmCenter: center, extendedCount }, confidence: extendedCount / 5 };
  }

  return { gesture: GESTURE_NONE, params: null, confidence: 0 };
}
