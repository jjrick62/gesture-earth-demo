# 会话交接 — 2026-05-10

## 本会话完成

### 手势管线重构
- [x] **捏合手势缩放** — gesture.js 加 pinch 检测（拇指尖-食指尖距离 < 0.4×手长），mapper.js 速度模型驱动缩放，优先级 `palm > pointUp > pinch > fist`
- [x] **卡片翻页** — pointUp 下一张、pointDown 上一张，动作级去抖（`_cardLocked` + `_pinchRecovery`），手势分类层不干预
- [x] **五指退出聚焦** — palm 检测到 `_focusedPlaceId` → resetView + 关 detail-card
- [x] **灵敏度显示** — 右下角面板实时显示 `getSens()`，+/-/R 更新

### 独立库接入手势控制常量
- [x] `constants.js` 集中化：`DECAY_*`/`GAIN_*`/`FREQ_RATIO`/`ZOOM_GAIN`
- [x] `mapper.js`/`earth.js` 全部引用常量，不再硬编码
- [x] 删死代码 `SM.*`

### 卡片系统（从旅行相册完整搬来）
- [x] `card.js` — 悬浮卡片 + SVG连接线 + 屏幕空间定位 + 聚类折叠/展开 + 详情卡
- [x] `utils.js` — `renderStars()`
- [x] 详情卡：名字/评分/坐标

### 移动端
- [x] 手机检测跳过 `_backMeshes` — 根治 16-bit 深度缓冲 z-fighting 频闪

### 工程化
- [x] 安装 `find-skills`（vercel-labs/skills）+ `superpowers`（obra/superpowers，14个skill）
- [x] `start.bat` 一键启动
- [x] 铁律 10、11 条新增

### 控制台修复
- [x] favicon 404 → data URI占位
- [x] BufferGeometry NaN → isFinite 守卫
- [x] districts 404 → 暂时关闭懒加载

## 当前状态

### 手势管线（稳定）

```
gesture.js ──→ mapper.js ──→ earth.js (_animate 60fps)
   │                │
   │                └──→ main.js onFrame → card.js navigateCard
   │
   优先级: palm > pointUp/Down > pinch > fist > none
```

### 手势映射

| 手势 | 动作 | 机制 |
|------|------|------|
| 🖐 五指张开 | 旋转+俯仰（速度模型） | 追踪手部XY移动 |
| 🤏 捏合 | 缩放（速度模型） | 追踪手部Y移动 |
| ☝ 食指朝上 | 下一张卡片 | 单次触发+动作锁 |
| 👇 食指朝下 | 上一张卡片 | 单次触发+动作锁 |
| ✊ 握拳 | 暂停自转 | — |
| 🖐+已聚焦 | 退出聚焦回地心 | resetView |

### 关键数值

| 常量 | 值 | 位置 |
|------|-----|------|
| pinch 阈值 | 0.4 | gesture.js:51 |
| ZOOM_GAIN | 20 | constants.js |
| DECAY_CAMERA | 0.85 | constants.js |
| DECAY_RENDER | 0.96 | constants.js |
| GAIN_ROTATE | 80 | constants.js |
| 捏合恢复帧数 | 5 | mapper.js:46 |
| 卡片锁 | _cardLocked | main.js:18 |

### 文件结构

```
js/
├── constants.js    ← 所有可调参数
├── gesture.js      ← 手势分类（5种手势，优先级清晰）
├── mapper.js       ← 手势→动作映射（累积+衰减，不直接操作场景）
├── earth.js        ← 3D渲染+缓动消费（_animate 60fps）
├── camera.js       ← MediaPipe摄像头+帧捕获
├── main.js         ← 主入口+卡片翻页去抖
├── card.js         ← 卡片系统（悬浮卡+详情卡+翻页导航）
├── ui.js           ← UI更新（手势状态+灵敏度显示）
└── utils.js        ← renderStars
```

## 明天任务：卡片管理控制台

参考旅行相册项目的功能，给 gesture-earth-demo 加：
1. **地点添加** — 表单输入名称/坐标/评分
2. **地点编辑** — 修改已有地点信息
3. **照片添加/删除** — 集成照片管理
4. **集成到现有 UI** — 可能是浮层控制台或侧边栏

旅行相册参考文件：
- `D:\大学作业文件夹\自制软件\旅行相册\js\app.js` — `openEditModal()`, `showDetail()`
- `D:\大学作业文件夹\自制软件\旅行相册\index.html` — `#detail-card` 结构（编辑/删除按钮、照片网格、备注）
- `D:\大学作业文件夹\自制软件\旅行相册\js\api.js` — IndexedDB CRUD 操作

注意：gesture-earth-demo 目前没有后端/IndexedDB，需要考虑数据持久化方案（localStorage 简单方案 vs 引入 IndexedDB vs 只做 UI 层）。

## 已知局限

- `china_districts.geojson` 23MB 未部署，懒加载已关闭
- 捏合阈值 0.4 需实测验证——可能需根据用户手型微调
- `ZOOM_GAIN=20` 是与旧食指缩放等效力校准的，可能需要主观调优
- 卡片导航只在有 `addPlace()` 添加的地点间循环（当前仅上海demo）
- `_pinchRecovery` 双写者问题未彻底修复（mapper设值+main递减），但目前工作正常
