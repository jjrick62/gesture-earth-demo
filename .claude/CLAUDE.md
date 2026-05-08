# gesture-earth-demo

手势控制 3D 地球 Demo — 用摄像头识别手势来旋转/缩放三维地球。

## 技术栈

- **Three.js 0.160** — 3D 渲染，CDN import map 方式加载
- **MediaPipe HandLandmarker** — `@mediapipe/tasks-vision@0.10.12`（新版同步 API）
- **纯原生 JS** — 无框架，无构建工具

## 架构

```
摄像头 → MediaPipe HandLandmarker → gesture.js（手势分类）→ mapper.js（状态映射+缓动惯性）→ earth.js（3D 渲染）
```

## 文件职责

| 文件 | 职责 |
|------|------|
| `js/camera.js` | 摄像头 + MediaPipe 初始化 + 帧捕获 + 骨骼绘制 |
| `js/gesture.js` | 手势分类（纯硬规则，比例判定）。**成果物，不要再改** |
| `js/mapper.js` | 手势→地球控制映射，旋转/缩放惯性缓动，localStorage 灵敏度持久化 |
| `js/earth.js` | Three.js 地球，粒子边界渲染，缩放图层显隐，流星特效。新增 `_loadRegion()` / `_scheduleRemaining()` / `_prioritizeRegion()` 异步加载管理器 |
| `js/constants.js` | 全局常量（摄像头分辨率、FPS 阈值、手势灵敏度、颜色） |
| `js/main.js` | 主入口，初始化流程 + 主循环 + 错误处理 |
| `js/ui.js` | 简单 UI 状态更新 |

## 启动

```bash
cd D:\大学作业文件夹\自制软件\gesture-earth-demo
npx http-server . -p 8082 -c-1
# 浏览器打开 http://localhost:8082，允许摄像头
```

## 手势映射

| 手势 | 动作 |
|------|------|
| 五指张开 + 移动 | 旋转地球 |
| 食指朝上 | 持续拉近 |
| 食指朝下 | 持续拉远 |
| 握拳 | 暂停自转 |

## 铁律（接手必读）

1. **gesture.js 是成果物，不要再改** — 手势分类已稳定
2. **`cos < -0.7` 判伸直，不是 `> 0.7`** — PIP→指尖朝外，PIP→MCP 朝掌心，两向量反向，cos 是负值
3. **MediaPipe tasks-vision `visibility` 永远为 0** — 新版 API 不输出逐点置信度，`(landmarks[i].visibility ?? 1) > 0.7` 这种门控全废
4. **绝对距离阈值不可靠** — 手远近不同判出结果不同，必须用比例判定
5. **`detectForVideo` 是同步返回结果** — `const result = _hands.detectForVideo(_video, now)`，不是回调模式
6. **MediaPipe 模型已本地化** — 模型文件在 `data/models/hand_landmarker.task`，`camera.js` 指向本地路径，不再依赖 Google CDN
7. **低频→高频变量必须补偿频率差** — 摄像头 15fps，渲染 60fps。任何从 mapper 写、earth 读的变量，要么除以 4，要么调整衰减系数（60fps 下 0.96 ≈ 15fps 下 0.85）
8. **持续操作的值用速度模型，不要用位置模型** — 旋转/俯仰必须走：累积 → 衰减 → 持续应用，不能在应用后清零（清零 = 退回 15fps 离散跳变）
9. **先加日志再调参** — `% N` 控制输出频率，`[tag]` 区分来源，数值入参出参全打出来，一次定位

## 命名约定

| 类别 | 规则 | 示例 |
|------|------|------|
| 仓库/项目 | kebab-case | `gesture-earth-demo` |
| JS 文件 | 小写单英文词 | `earth.js`, `camera.js` |
| CSS/HTML | 小写 | `style.css`, `index.html` |
| 数据文件 | snake_case | `world_admin1.geojson` |
| 目录 | 小写语义名 | `js/`, `css/`, `data/map/` |
| JS 类 | PascalCase | `class Earth {}` |
| JS 函数/方法 | camelCase | `loadAdminBoundaries()` |
| JS 私有成员 | `_` 前缀 | `_hands`, `_rotV`, `_zoomV` |
| JS 常量 | UPPER_SNAKE | `FPS_WARN_THRESHOLD` |
| Three.js mesh 键 | camelCase，`Points` 后缀 | `admin1ChinaPoints`, `cityPoints` |

## 数据文件

`data/map/` 目录（GeoJSON）：

| 文件 | 大小 | 用途 |
|------|------|------|
| `admin1_china.geojson` | 387 KB | 中国省界（CN+HK+TW+MO），72 features |
| `admin1_asia.geojson` | 3.8 MB | 亚太州界（东亚/东南亚/南亚/大洋洲/中亚/俄罗斯） |
| `admin1_eur_amer.geojson` | 12.7 MB | 欧美州界（欧洲/北美/南美/非洲/中东） |
| `china_cities.geojson` | 3.1 MB | 中国地级市，363 features |
| `borders.geojson` | 0.3 MB | 国界线 |
| `coastline.geojson` | 0.1 MB | 海岸线 |

`data/models/` 目录：

| 文件 | 大小 | 用途 |
|------|------|------|
| `hand_landmarker.task` | 7.8 MB | MediaPipe 手部骨骼识别模型（本地化） |

加载策略：中国 await 先加载，亚太/欧美后台异步；`focusOnPlace()` 根据目标经纬度自动判断区域并插队优先加载。

## 2026-05-08 已完成的优化

- [x] MediaPipe 模型本地化 — `hand_landmarker.task` 放入 `data/models/`，`camera.js` 指向本地
- [x] GeoJSON 按区域拆分异步加载 — `world_admin1` 拆为 china/asia/eur_amer 三个文件
- [x] 智能优先级 — `_loadRegion()` + `_scheduleRemaining()` + `_prioritizeRegion()` 加载管理器
- [x] 缩放三级阈值 — 中国 2.8 / 亚太 2.5 / 欧美 2.2
- [x] 清理死文件 — 删除 `world_admin1.geojson`、`china_provinces.geojson`
- [x] 项目工程化 — `.claude/CLAUDE.md` + `.claude/settings.json`
- [x] 验证脚本 — `scripts/verify.py`，28/28 全部通过
- [x] 手势缓动 15→60fps — mapper 只写目标速度，earth._animate() 平滑应用旋转/俯仰/缩放
- [x] MediaPipe 帧跳过 — `_inferencing` 门卫 + `_skipCount` 兜底，防 WASM 推理积压
- [x] 手势骨架镜像 — `gesture-canvas` 加 `transform: scaleX(-1)` 匹配摄像头视频
- [x] 空闲刹车 — 手掌移开后旋转/俯仰自然衰减（0.96/frame），不等 mapper 清零

## 性能优化（进行中）

### 已识别的瓶颈（详见本轮性能分析）

| 级别 | 问题 | 影响 |
|------|------|------|
| ✅ 已解决 | 手势缓动 15→60fps — mapper/earth 速度模型重构 | 旋转/俯仰/缩放丝滑 |
| ✅ 已解决 | MediaPipe 推理无跳帧 — `_inferencing` 门卫 | 主线程不积压 |
| 🔴 致命 | 粒子超绘 40万~100万+ × 2（正反面克隆），全部 AdditiveBlending | GPU fill rate |
| 🔴 致命 | `admin1_eur_amer.geojson` 仍有 14MB，远距不可见时仍需下载 | 带宽 |
| 🟠 重要 | `gesture.js` 每帧构建字符串（ratios.push），1/30 才用 | GC |
| 🟠 重要 | 摄像头 FPS 控制不准（setTimeout+rAF 嵌套） | 帧率漂移 |
| 🟡 中等 | 热路径 Vector3 分配、多路 Math.sin/acos、无距离 LOD、无 Worker | 综合 |

### 下一步

- [ ] 粒子 LOD — 远距降低粒子密度/跳过小图层（shader 背面密度控制待定）
- [ ] 延后 `admin1_eur_amer` 加载 — 只在缩放触发时才 fetch
- [ ] 摄像头帧率控制优化（setTimeout+rAF 嵌套改为纯 rAF + 帧计数）
- [ ] gesture.js 减少 GC 分配
- [ ] 手势展开卡片详情功能
