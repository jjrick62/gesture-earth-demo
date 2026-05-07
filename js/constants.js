// 摄像头（camera.js 用）
export const CAMERA_VIDEO   = { WIDTH: 640, HEIGHT: 480, FPS: 15 };
export const FPS_WARN_THRESHOLD = 10;
export const FPS_SAMPLE_WINDOW  = 30;

// 状态机配置（mapper.js 用）
export const SM = {
  ZOOM_IN:  0.04,       // 捏合拉近速度
  ZOOM_OUT: 0.06,       // 拉远速度
  PINCH_SHORT: 400,     // 短捏阈值 ms
  PINCH_TIMEOUT: 800,   // 拉远超时 ms
};

// 灵敏度
export const SENS = { ROTATE: 0.005 };
