# Gesture Earth Demo

手势控制 3D 地球 — 用摄像头识别手势来旋转/缩放三维地球。

## 在线体验

**https://jjrick62.github.io/gesture-earth-demo**

> 需要摄像头权限。国内用户可能需要 VPN 加载 CDN 依赖（Three.js、MediaPipe WASM）。

## 启动

```bash
cd D:\大学作业文件夹\自制软件\gesture-earth-demo
npx http-server . -p 8082 -c-1
```

浏览器打开 `http://localhost:8082`，允许摄像头权限。

> 需要 HTTPS 或 localhost 才能使用摄像头 API。

## 手势操作

| 手势 | 动作 |
|------|------|
| 🖐 五指张开 + 移动 | 旋转地球 |
| ☝ 食指朝上 | 持续拉近放大 |
| 👇 食指朝下 | 持续拉远缩小 |
| ✊ 握拳 | 暂停/恢复自转 |

手掌移开（无手势）后，地球惯性滑行减速，平滑恢复自转。

## 键盘快捷键

| 键 | 功能 |
|------|------|
| `+` / `-` | 调节手势灵敏度 |
| `R` | 重置灵敏度 |
| 空格 | 暂停/恢复地球自转 |
| 鼠标拖拽 | OrbitControls 手动旋转/缩放 |

## 架构

```
摄像头（15fps）
   ↓
MediaPipe HandLandmarker（WASM 推理）
   ↓
gesture.js（手势分类，纯硬规则）
   ↓
mapper.js（速度模型：累积+衰减，写目标值）
   ↓
earth.js _animate()（60fps 平滑应用旋转/俯仰/缩放）
```

手势与渲染解耦：mapper 只当"传感器"写目标速度，earth 的 60fps 渲染循环负责插值和平滑。

## 项目结构

```
gesture-earth-demo/
├── index.html
├── css/style.css
├── js/
│   ├── main.js          # 主入口，初始化流程
│   ├── camera.js        # 摄像头 + MediaPipe 帧捕获 + 帧跳过守卫
│   ├── gesture.js       # 手势分类（纯硬规则，比例判定）— 成果物
│   ├── mapper.js        # 手势→速度映射（累积+衰减，不操作场景）
│   ├── earth.js         # Three.js 粒子地球 + 60fps 缓动 + 异步加载
│   ├── constants.js     # 全局常量
│   └── ui.js            # UI 状态更新
├── data/
│   ├── map/             # GeoJSON 边界数据（按区域拆分）
│   │   ├── admin1_china.geojson    # 中国省界（72 features）
│   │   ├── admin1_asia.geojson     # 亚太州界
│   │   ├── admin1_eur_amer.geojson # 欧美州界
│   │   ├── china_cities.geojson    # 中国地级市
│   │   ├── borders.geojson         # 国界线
│   │   └── coastline.geojson       # 海岸线
│   └── models/
│       └── hand_landmarker.task    # MediaPipe 手部骨骼模型（本地）
├── scripts/
│   ├── verify.py        # 全链路验证脚本（28/28 通过）
│   └── patch_earth.py   # earth.js 补丁工具
└── .claude/             # Claude Code 项目配置
    ├── CLAUDE.md        # 铁律 + 架构 + 命名约定 + 已完成事项
    └── settings.json
```

## 数据加载策略

- **中国优先** — `admin1_china.geojson`（425 KB）await 同步加载，省界最先显示
- **按需插队** — 缩放或 `focusOnPlace()` 触发时，根据经纬度自动判断区域，优先加载对应数据
- **兜底顺序** — 亚太 → 欧美，后台异步加载，不阻塞交互
- **三级显隐** — 缩放时中国省界（地心距 2.8）→ 亚太州界（2.5）→ 欧美州界（2.2）渐进淡入

## 已优化项

| 优化 | 说明 |
|------|------|
| 手势缓动 60fps | mapper 写目标速度，earth 渲染循环平滑插值，消除 15fps 跳变 |
| 帧跳过守卫 | MediaPipe 推理积压时跳过新帧，主线程留给渲染 |
| 空闲刹车 | 手掌移开后旋转/俯仰惯性衰减（0.96/frame），不突兀 |
| 镜像骨架 | 手势骨架 canvas 与摄像头视频同步镜像 |
| 模型本地化 | `hand_landmarker.task` 本地加载，不依赖 Google CDN |
| GeoJSON 异步加载 | 16.5MB 拆分三区域，中国优先 + 按需插队 |

> 开发者接手请先读 `.claude/CLAUDE.md`，内含 9 条铁律和命名约定。

## 技术栈

- **Three.js 0.160** — 3D 粒子地球，CDN import map 加载
- **MediaPipe HandLandmarker** — `@mediapipe/tasks-vision@0.10.12`，WASM 推理，模型本地化
- **纯原生 JS** — 无框架，无构建工具
