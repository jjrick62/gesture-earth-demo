// 摄像头配置
export const CAMERA_VIDEO = {
  WIDTH: 640,
  HEIGHT: 480,
  FPS: 15,
};

// 手势判定阈值（归一化坐标，0~1）
export const GESTURE = {
  PINCH_DISTANCE: 0.65,        // 相对距离阈值：拇指-食指距 / 手部尺度
  FIST_GRIP_RATIO: 0.55,
  FINGER_EXTEND_ANGLE: 0.70,
  EXTENDED_FINGERS_MIN: 3,     // 3指伸直即判定张开手掌
  INDEX_ONLY_MAX: 1,
  DEBOUNCE_FRAMES: 5,          // 手势切换需要更多帧确认，减少抖动
  FIST_HOLD_MS: 500,
};

// 地球控制灵敏度
export const SENSITIVITY = {
  ROTATE: 0.005,
  ZOOM: 0.3,
  STEP: 0.1,
  MIN: 0.1,
  MAX: 3.0,
};

// 地图文件
export const MAP_FILES = ['coastline.geojson', 'borders.geojson'];

// FPS 监控
export const FPS_WARN_THRESHOLD = 10;
export const FPS_SAMPLE_WINDOW = 30;

// 手势提示
export const HINT_HIDE_DELAY = 3000;
