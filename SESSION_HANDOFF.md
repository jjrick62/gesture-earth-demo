---
name: 2026-05-08 会话交接
description: 今日完整进度摘要——给下一个 Agent 的上下文
type: project
originSessionId: 0d1b3193-d037-4d84-9690-c16a7f4713ea
---
# 2026-05-08 会话产物总览

## 三个活跃仓库

| 仓库 | 分支 | Pages | 用途 |
|---|---|---|---|
| `jjrick62/travel-album-3d` | `master` | — | 旅行相册后端版（FastAPI+SQLite） |
| `jjrick62/travel-album-3d` | `static` | `jjrick62.github.io/travel-album-3d` | 纯静态版（IndexedDB，含上海市示例） |
| `jjrick62/jjrick62.github.io` | `master` | `jjrick62.github.io` | 顶级域名，完整旅行相册静态版 |
| `jjrick62/gesture-earth-demo` | `master` | `jjrick62.github.io/gesture-earth-demo` | 手势控制 3D 地球 Demo |

## 一、旅行相册主项目（D:\大学作业文件夹\自制软件\旅行相册\）

### 前端改进（两个分支都有）
- `js/logger.js` — 点击日志工具。F12 控制台：`logEvents()`、`logClear()`、`logExport()`、`logToggle()`
- 摄像机初始高度：根据屏幕宽高比连续计算（`aspect → t → camY/camZ`），不再三档硬切
- 拖拽地球时：取消飞行动画 + target 切回地心 (0,0,0) + 恢复 savedMinDist
- 全局点击：非交互区域 → 关闭详情卡片 + 回退视角
- `.gitignore` 加了 `backend/travel_album.db`、`backend/uploads/`、`__pycache__/`

### 后端（仅 master 分支）
- `backend/` 目录：FastAPI + SQLite + JWT 认证
- 文件：`main.py`、`config.py`、`database.py`、`models.py`、`schemas.py`、`auth.py`、`storage.py`、`routers/auth.py`、`routers/places.py`、`routers/photos.py`、`routers/meta.py`
- 数据模型：User → Place → Photo + UserMeta
- API：`/api/auth/register`、`/api/auth/login`、`/api/places` CRUD、`/api/photos` 上传/下载、`/api/meta`
- 照片：不再 base64 存 IndexedDB，改为文件系统存储（`uploads/{user_id}/{place_id}/{uuid}.jpg`）
- 前端对应：`js/api.js`（替代 `js/data.js`），接口签名相同，HTTP fetch 替代 IndexedDB
- 认证 UI：登录/注册模态框 + 退出登录按钮
- 数据迁移工具：`migrate.html`（IndexedDB → 后端 API）

### 启动后端
```bash
cd D:\大学作业文件夹\自制软件\旅行相册\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 启动前端
```bash
cd D:\大学作业文件夹\自制软件\旅行相册
npx http-server . -p 8081 -c-1
```

### 微信域名验证
文件 `212e3fd15abb06ec3f3fbff169f2fa13.txt` 放在 `jjrick62.github.io` 顶级仓库根目录。

## 二、手势 Demo（D:\大学作业文件夹\自制软件\gesture-earth-demo\）

### 架构
```
摄像头 → MediaPipe HandLandmarker → gesture.js（分类）→ mapper.js（映射）→ earth.js（控制）
```

### 关键文件
- `js/gesture.js` — 手势分类，纯硬规则，尺度无关比例判定。**成果物，不要再改了**
- `js/mapper.js` — 状态映射，带缓动惯性
- `js/camera.js` — 摄像头 + MediaPipe，使用 `@mediapipe/tasks-vision`（新版 API）
- `js/earth.js` — 从主项目复制

### gesture.js 核心逻辑（接手者必读）
- **伸直判定**：PIP→指尖 与 PIP→MCP 向量夹角余弦。**注意 cos < -0.7（不是 > 0.7）**，因为两向量反向
- **弯曲判定**：指尖→掌心距 ÷ 手腕→掌心距 < 0.6。比例判定，尺度无关
- **决策树**：≥4 指伸直=palm → 食指伸直+≥3 其余弯曲=pointUp/pointDown → ≥4 弯曲=fist → 其余=none
- **上下方向**：指尖 y < MCP y = pointUp（MediaPipe y=0 在顶部）

### mapper.js 核心逻辑
- palm：手掌移动→旋转地球（镜像+20倍率+惯性缓动），自转关闭
- pointUp：持续拉近
- pointDown：持续拉远
- fist：暂停自转
- none：恢复自转
- 缩放和旋转都有缓动衰减

### 当前手势映射
| 手势 | 动作 |
|---|---|
| 🖐 张开手掌移动 | 旋转地球 |
| ☝ 食指朝上 | 拉近放大 |
| 👇 食指朝下 | 拉远缩小 |
| ✊ 握拳 | 暂停自转 |

### 启动
```bash
cd D:\大学作业文件夹\自制软件\gesture-earth-demo
npx http-server . -p 8082 -c-1
# 浏览器 http://localhost:8082，允许摄像头
```

### 预置数据
上海市示例：`earth.setHome(31.2304, 121.4737, '上海市', '上海市')` + `earth.addPlace(...)`

### 已知问题
1. 手机端性能未优化
2. 缺少手势展开卡片详情功能
3. 省市级地图首次加载需等待（已在后台预加载 coastlines + adminBoundaries + cities）

## 三、关键技术教训

### 血泪教训（接手者牢记）
1. **`cos < -0.7` 判伸直，不是 `> 0.7`** — 这个 bug 从初版 classifier.js 就存在，所有分类失败最终都源于此。PIP→指尖朝外，PIP→MCP 朝掌心，两向量反向，cos 是负值
2. **绝对距离阈值不可靠** — `Math.hypot(pt.x-m.x, pt.y-m.y) < 0.25` 依赖手在画面中的大小，远近不同判出来不同。必须用比例
3. **MediaPipe HandLandmarker（tasks-vision API）的 `visibility` 永远为 0** — 新 API 不输出逐点置信度，老代码里 `(landmarks[i].visibility ?? 1) > 0.7` 这种门控全废
4. **`detectForVideo` 在新 API 是同步返回结果** — `const result = _hands.detectForVideo(_video, now); onHandsResults(result)`，不是回调模式
5. **`estimate()` 返回 `{gestures: [...]}` 不是数组** — fingerpose 踩过这个坑
6. **fingerpose 最终被弃用** — 手势不多时，纯硬规则更可控

### 踩过的坑（知道即可，不必重复）
- fingerpose CDN 的 ESM 版不存在，只能用 UMD + 全局 `fp` 对象
- fingerpose `addDirection` 在摄像头镜像+MediaPipe 坐标系下方向判不准
- fingerpose 加权匹配在两手势相近时结果不稳定（fist vs point），不如硬规则互斥判定
- `world_admin1.geojson`（17MB）和 `china_cities.geojson`（3.3MB）需要手动复制到 demo

## 四、下一个 Agent 的优先任务

1. **性能优化** — 手机端帧率低：降低 MediaPipe 输入分辨率、减少粒子数、FPS 自适应降级
2. **手势功能扩展** — 手势展开地点详情卡片、手势切换图层
3. **可选** — Vue/React 框架化（如果用户决定）

## 五、用户偏好速查

- 自称"洒家"，水浒腔调
- 大数据专业大二，做项目出于兴趣+简历
- 工具装 D:\tool，别塞 C 盘
- GitHub: `jjrick62`，token 在 `C:\Users\lenovo\.claude\mcp.json`；推送完擦 remote URL 里的 token
- 每个项目独立建 GitHub 仓库
- 默认项目目录：`D:\大学作业文件夹\自制软件\`
- 操作前先说清楚再动手
