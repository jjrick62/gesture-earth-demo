# 会话交接 — 2026-05-09

## 全日成果总览

### 一、手势管线重构（核心工作）

#### 1.1 手势分类器（gesture.js）
- **新增捏合检测**：拇指尖(4)→食指尖(8)距离 ÷ 手掌大小 < 0.4 → `pinch`
- **食指绝对方向检测**：3D 向量归一化，`dirY < -0.5` 才判朝上、`dirY > 0.5` 判朝下。替代原来粗糙的 `tip.y < mcp.y`
- **最终优先级**：`palm > pinch > pointUp > fist > none`
- **手势种类**：从 4 种扩展到 5 种（palm / pinch / pointUp / pointDown / fist）

#### 1.2 映射器（mapper.js）
- **捏合→缩放**：速度模型，追踪手部 Y 轴移动，和旋转同模式（累积+衰减+60fps消费）
- **食指上下→卡片翻页**：设置 `_gestureCardNext/_gestureCardPrev` 信号，不直接操作场景
- **五指→退出聚焦**：检测 `_focusedPlaceId` → resetView() + 关 detail-card
- **灵敏度显示**：新增 `getSens()` 导出
- **常量化**：所有增益/衰减值从 `constants.js` 导入，不再硬编码

#### 1.3 动作去抖层（main.js）
- `_cardLocked`：卡片翻页单次触发锁（食指持续伸着只翻一次）
- `_pinchRecovery`：捏合松手后 5 帧恢复期，防松手误判成 pointUp
- 手势分类层不干预，只在动作层去抖

#### 1.4 调试历程（重要——避免重复踩坑）

| 迭代 | 尝试 | 结果 | 教训 |
|------|------|------|------|
| 1 | 优先级 `palm>fist>pinch>pointUp`，ZOOM_GAIN=0.03 | 捏合/食指都被fist吃了，缩放不动 | ①改优先级必须画状态转移表 ②增益必须对照消费门槛 |
| 2 | 加 `_cooldown` 抑制手势分类 | 连握拳待机也毙了 | 别在分类层抑制，在动作层去抖 |
| 3 | `_prevG` 边沿检测 | 状态机振荡（握拳↔手掌反复跳） | 边沿检测不适合作连续姿态 |
| 4 | 优先级 `palm>pointUp>fist>pinch` | 捏合被fist吃（curl>=4先到） | fist和pinch易混淆，需让pinch优先 |
| 5 | 优先级 `palm>pointUp>pinch>fist` | 捏合时食指微弯被判伸直→pointUp先到 | 需要pinch在pointUp前面 |
| 6 | **最终**：`palm>pinch>pointUp>fist` + 食指绝对方向±0.5 | ✅ 五手势互不干扰 | pinch同pointUp由拇指-食指距离自然区分 |

### 二、工程化

#### 2.1 手势控制常量集中化（constants.js）
```
CAMERA_VIDEO, FPS_WARN_THRESHOLD, FPS_SAMPLE_WINDOW
SENS.ROTATE = 0.005
DECAY_CAMERA=0.85, DECAY_RENDER=0.96, DECAY_ZOOM=0.9
GAIN_ROTATE=80, GAIN_PITCH=50, GAIN_ZOOM=0.02, ZOOM_GAIN=20
FREQ_RATIO = 15/60
```
mapper.js 和 earth.js 全部引用常量，删除了无人引用的 `SM.*` 死代码。

#### 2.2 卡片系统（从旅行相册完整搬来）
- `card.js`（~420行）：悬浮卡片 + SVG连接线 + 屏幕空间定位 + 聚类折叠/展开 + 详情卡 + `navigateCard()`
- `utils.js`：`renderStars()` 星星评分
- 详情卡 DOM：名字/评分/坐标

#### 2.3 Skill 系统安装
- `find-skills` — vercel-labs/skills（140万安装）
- `superpowers` 14件套 — obra/superpowers（brainstorming, systematic-debugging, test-driven-development, writing-plans 等）
- `frontend-design` — 已存在

#### 2.4 铁律更新
新增第 10、11 条：
> 10. 改增益/阈值必须对照消费端门槛 — earth._animate()有 >0.001/>0.0001 守卫
> 11. 新增跨模块共享变量必须明确单一写者 — 用命名约定标识owner

### 三、3D 渲染

#### 3.1 移动端粒子频闪修复
- 检测 `isMobile`（UA + pointer:coarse 媒体查询）
- 跳过后半球 `_backMeshes`（省一半粒子 + 根除 16-bit 深度 z-fighting）

#### 3.2 外国行政区轮廓提亮
| 区域 | 调整前(有效亮度) | 调整后 |
|------|:--:|:--:|
| 中国 | 0.44 | 不变 |
| 亚太 | 0.32 | 0.38 (+18%) |
| 欧美 | 0.22 | 0.32 (+48%) |

#### 3.3 控制台报错清理
- favicon 404 → `<link rel="icon" href="data:,">`
- BufferGeometry NaN → `isFinite(lng/lat)` 双守卫 + geojson.features 空检查
- districts 404 → 暂关 `loadDistricts()` 懒加载（23MB 文件未部署）

### 四、UI

- 手势面板从右下移至摄像头上方（左下），不被详情卡遮挡
- 手势提示面板更新为 5 种新手势
- `start.bat` 一键启动脚本
- 预置 5 个示例城市：上海/北京/南京/洛杉矶/纽约

---

## 当前状态快照

### 手势管线（稳定版）

```
gesture.js ──→ mapper.js ──→ earth.js (_animate 60fps)
   │                │
   │ 优先级:         └──→ main.js onFrame → card.js navigateCard
   │ palm > pinch >       动作去抖: _cardLocked + _pinchRecovery
   │ pointUp > fist
```

### 手势映射表

| 手势 | 动作 | 机制 |
|------|------|------|
| 🖐 五指张开 | 旋转+俯仰 | 速度模型，追踪XY |
| 🤏 捏合 | 缩放 | 速度模型，追踪Y |
| ☝ 食指朝上 | 下一张卡片 | 单次触发+动作锁 |
| 👇 食指朝下 | 上一张卡片 | 单次触发+动作锁 |
| ✊ 握拳 | 暂停自转 | — |
| 🖐+已聚焦 | 退出聚焦→地心 | resetView |

### 关键文件行号速查

| 文件 | 关键内容 | 行号 |
|------|------|------|
| `gesture.js` | 捏合检测 `pinchRatio<0.4` | 55 |
| `gesture.js` | 食指方向 `dirY<-0.5 / >0.5` | 48 |
| `gesture.js` | 优先级顺序 | 60-65 |
| `mapper.js` | palm 旋转+俯仰 | 18-42 |
| `mapper.js` | pinch 缩放速度模型 | 43-57 |
| `mapper.js` | pointUp/Down 卡片信号 | 64-71 |
| `main.js` | 卡片去抖 `_cardLocked` | 18 |
| `main.js` | onFrame 翻页逻辑 | 32-49 |
| `earth.js` | 手势缓动块 `_animate()` | 948-990 |
| `earth.js` | 移动端 `_isMobile` | 28 |
| `earth.js` | 背面粒子 `_backMeshes` 守卫 | 182 |

### 5 个示例城市

| ID | 城市 | 坐标 | 评分 | 颜色 |
|------|------|------|:--:|------|
| demo-shanghai | 上海 | 31.23, 121.47 | ★5 | 白 |
| demo-beijing | 北京 | 39.90, 116.41 | ★5 | 红 |
| demo-nanjing | 南京 | 32.06, 118.80 | ★4 | 金 |
| demo-losangeles | 洛杉矶 | 34.05, -118.24 | ★4 | 蓝 |
| demo-newyork | 纽约 | 40.71, -74.01 | ★5 | 紫 |

### GitHub 状态

- 最新 commit：`b64b3c7`（本地），推送待新 token
- Token 过期需重新生成 → GitHub Settings → Developer settings → Personal access tokens → classic，勾 repo

---

## 明天任务：卡片管理控制台

参考 `D:\大学作业文件夹\自制软件\旅行相册\` 实现：

1. **地点添加** — 表单输入名称/坐标/评分，写入 `earth._places` + `earth.addPlace()` + `syncPlaceCards()`
2. **地点编辑** — 修改已有地点信息（名称/评分）
3. **照片添加/删除** — 集成照片管理（参考旅行相册 `api.js` IndexedDB 方案）
4. **控制台 UI** — 浮层/侧边栏，与现有手势控制共存

### 技术选型建议
- 数据持久化：从 localStorage 简单方案起步（与现有 `gs3` 灵敏度存储一致），复杂后再迁 IndexedDB
- 控制台放在详情卡 `#detail-card` 内扩展编辑/删除按钮
- 照片功能需处理 base64 存储（参考旅行相册 `uploadPhoto` → base64 dataUrl）

### 旅行相册参考文件
- `js/app.js` — `openEditModal()`, `showDetail()`, `renderPhotos()`
- `js/api.js` — `initDB()`, `savePlace()`, `deletePlace()`, `uploadPhoto()`
- `index.html` — `#detail-card` 编辑/删除按钮、照片网格结构

---

## 已知局限

- `china_districts.geojson` 23MB 未部署，懒加载已注释
- `ZOOM_GAIN=20` 已校准到旧食指缩放的等效力度，可能需要主观微调
- 捏合阈值 0.4 基于理论估算，需实测验证不同手型
- 卡片导航目前只在 5 个预置示例城市间循环
- GitHub Token 过期，新 session 需重新生成推送
- `_pinchRecovery` 双写者模式工作正常但架构不干净（mapper 设值 + main 递减），建议后续重构为单一 owner
