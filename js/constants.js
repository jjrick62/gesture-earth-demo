// ===== 手势控制全局常量 =====

// 摄像头（camera.js 用）
export const CAMERA_VIDEO = { WIDTH: 640, HEIGHT: 480, FPS: 15 };
export const FPS_WARN_THRESHOLD = 10;
export const FPS_SAMPLE_WINDOW = 30;

// 灵敏度默认值
export const SENS = { ROTATE: 0.005 };

// 速度模型衰减
// 摄像头帧速率衰减（累积量衰减）
export const DECAY_CAMERA = 0.85;
// 渲染帧速率衰减（空闲刹车，0.96^60/s ≈ 1-2 秒归零）
export const DECAY_RENDER = 0.96;
// 缩放衰减（略快）
export const DECAY_ZOOM = 0.9;

// 增益（手移动速度 → 目标角速度）
export const GAIN_ROTATE = 80;
export const GAIN_PITCH = 50;
export const GAIN_ZOOM = 0.02;

// 频率补偿系数（摄像头 15fps → 渲染 60fps）
export const FREQ_RATIO = 15 / 60;
