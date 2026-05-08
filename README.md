# Gesture Earth Demo

手势控制 3D 地球 — 用摄像头识别手势来旋转/缩放三维地球。

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

## 键盘快捷键

| 键 | 功能 |
|------|------|
| `+` / `-` | 调节手势灵敏度 |
| `R` | 重置灵敏度 |
| 空格 | 暂停/恢复地球自转 |

## 架构

```
摄像头 → MediaPipe HandLandmarker → gesture.js（分类）→ mapper.js（映射+缓动）→ earth.js（3D 渲染）
```

## 项目结构

```
gesture-earth-demo/
├── index.html
├── css/style.css
├── js/
│   ├── main.js          # 主入口，初始化流程
│   ├── camera.js        # 摄像头 + MediaPipe 帧捕获
│   ├── gesture.js       # 手势分类（纯硬规则，比例判定）
│   ├── mapper.js        # 手势→地球控制映射，惯性缓动
│   ├── earth.js         # Three.js 粒子地球，异步加载管理器
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
└── .claude/             # 项目工程化配置
    ├── CLAUDE.md
    └── settings.json
```

## 数据加载策略

- **中国优先** — `admin1_china.geojson`（425 KB）await 同步加载，省界最先显示
- **按需插队** — 缩放或 `focusOnPlace()` 触发时，根据经纬度自动判断区域，优先加载对应数据
- **兜底顺序** — 亚太 → 欧美，后台异步加载，不阻塞交互
- **三级显隐** — 缩放时中国省界（地心距 2.8）→ 亚太州界（2.5）→ 欧美州界（2.2）渐进淡入

## 技术栈

- **Three.js 0.160** — 3D 粒子地球，CDN import map 加载
- **MediaPipe HandLandmarker** — `@mediapipe/tasks-vision@0.10.12`，WASM 推理，模型本地化
- **纯原生 JS** — 无框架，无构建工具
