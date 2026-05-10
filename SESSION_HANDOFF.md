# 会话交接 — 2026-05-10

## 全日成果

### 一、卡片管理控制台（从旅行相册完整搬运）

**搬运原则**：DOM 结构、CSS 样式、事件逻辑全部从旅行相册原样搬运，仅 API 层从 REST 调用改为 localStorage（后又换回 REST API + 搬运后端）。

**改动文件**：
- `index.html` — 编辑弹窗 `#add-modal`（城市搜索/日期/评分/感想/照片）、详情卡 `#detail-card`（照片网格/编辑删除按钮）、认证弹窗 `#auth-modal`、右上角 `+` 按钮
- `css/style.css` — 从旅行相册完整搬运：模态框、表单、搜索、星星、照片网格、响应式，保留手势相关样式
- `js/console.js` — 新建 ~400 行：`openEditModal` / `_savePlace` / `_deleteFromModal` / 城市搜索 / 照片管理 / 认证流程 / 事件绑定
- `js/api.js` — 从旅行相册直接复制（REST API 客户端，JWT token 管理）
- `js/card.js` — `showDetail` 换为旅行相册版（可点击星星评分 + 照片网格 + 感想 + 编辑/删除按钮）
- `js/card.js` — `createPlaceCard` 星星内联生成（移除 `renderStars` 依赖）
- `data/cities.json` — 423KB，3000+ 中国城市数据
- `js/main.js` — 移除硬编码 demo 城市，改为 `initConsole(_earth)`

### 二、FastAPI 后端（从旅行相册完整搬运）

```
backend/
├── main.py          # FastAPI + CORS（8082）+ lifespan
├── config.py        # SECRET_KEY / DATABASE_URL / UPLOAD_DIR / CORS
├── database.py      # SQLAlchemy async + aiosqlite
├── models.py        # User / Place / Photo / UserMeta 四表
├── schemas.py       # Pydantic 请求/响应模型
├── auth.py          # bcrypt + JWT（python-jose）
├── storage.py       # aiofiles 照片文件存取
├── requirements.txt # 8 个依赖
└── routers/
    ├── auth.py      # register / login / me
    ├── places.py    # CRUD /api/places
    ├── photos.py    # upload / serve（无认证⚠️） / delete
    └── meta.py      # GET/PUT /api/meta
```

- 照片存储：`uploads/{user_id}/{place_id}/{uuid}.jpg`
- 认证：JWT 7 天过期，bcrypt，每请求校验 `user_id` 所有权
- 数据隔离：Photo → Place → User，所有查询带 `user_id` 过滤
- 启动：`start.bat` 自动 pip install + uvicorn :8000 + http-server :8082

### 三、earth.js 改动

- **`removePlace(id)`** — 清理 sprite/fill/clickMesh/visitedClusters + delete `_places[id]`
- **`_onDataReady`** — `loadAdminBoundaries` 省界加载完后也触发回调（之前只有 `loadCities` 触发）
- **填充轮廓修复** — console.js 挂 `_onDataReady`，地图数据就绪后无填充的地点自动 `removePlace` + `addPlace` 重建

### 四、国际城市支持

- 模态框新增经纬度手动输入框
- 搜索提示词改为"搜索中国城市，或直接输入国际城市名称..."
- 保存逻辑三路径：下拉选中 → 数据库匹配 → 手动坐标输入

### 五、安全审计

完成全量 26 项安全审查，详见 `.claude/SECURITY_SCHEDULE.md`：
- **严重 2 项**：存储型 XSS（card.js:48 innerHTML）、DOM XSS（main.js:15 fatal 函数）
- **高危 8 项**：默认 JWT 密钥、路径遍历、上传无限制、照片无认证、无频率限制、无暴力破解防护、无邮箱验证、无 CSP
- 已按三阶段排期：紧急修复 8 项（2h）→ 业务安全 7 项（3h）→ 架构加固 11 项（4h）

---

## 当前状态

### 数据流

```
浏览器 ──REST──> FastAPI :8000 ──SQLAlchemy──> SQLite (backend/travel_album.db)
                      │
                      └── 照片 ──> uploads/{user}/{place}/{uuid}.jpg
```

### 启动

```bat
cd D:\大学作业文件夹\自制软件\gesture-earth-demo
start.bat
```

### API 端点

| 方法 | 路径 | 认证 |
|------|------|:--:|
| POST | `/api/auth/register` | 否 |
| POST | `/api/auth/login` | 否 |
| GET | `/api/places` | 是 |
| POST | `/api/places` | 是 |
| PUT | `/api/places/{id}` | 是 |
| DELETE | `/api/places/{id}` | 是 |
| POST | `/api/photos/places/{id}` | 是 |
| GET | `/api/photos/file/{path}` | **否⚠️** |
| DELETE | `/api/photos/{id}` | 是 |
| GET | `/api/meta` | 是 |

### 手势管线（未改动）

```
gesture.js ──→ mapper.js ──→ earth.js (_animate 60fps)
    │               │
    │ 优先级:        └──→ main.js onFrame → card.js navigateCard
    │ palm > pinch >       动作去抖: _cardLocked + _pinchRecovery
    │ pointUp > fist
```

### 关键文件行号速查

| 文件 | 内容 | 行号 |
|------|------|:--:|
| `js/console.js` | `openEditModal` | 161 |
| `js/console.js` | `_savePlace`（API 版） | 217 |
| `js/console.js` | `_doInit` / `_applyPlaces` | 82 |
| `js/console.js` | `_bindAuthEvents` | 298 |
| `js/card.js` | `showDetail`（旅行相册版） | 382 |
| `js/card.js` | `_renderDetailPhotos` | 423 |
| `js/card.js` | `createPlaceCard`（⚠️ XSS 漏洞） | 43 |
| `js/earth.js` | `removePlace` | 666 |
| `js/earth.js` | `_onDataReady` 触发点 | 289, 349 |
| `backend/storage.py` | 路径遍历漏洞 | 24, 30 |
| `backend/config.py` | 默认密钥 | 3 |
| `js/main.js` | fatal() XSS 漏洞 | 15 |

---

## 明天任务（按优先级）

### 1. 安全修复第一阶段（必须先做，详见 `.claude/SECURITY_SCHEDULE.md`）

| 顺序 | 文件 | 问题 | 方案 |
|:--:|------|------|------|
| 1 | `card.js:48` | innerHTML XSS | → DOM API + textContent |
| 2 | `main.js:15` | fatal() DOM XSS | → textContent |
| 3 | `storage.py:24,30` | 路径遍历 | normpath + 前缀校验 |
| 4 | `config.py:3` | 默认密钥 | 启动时检查环境变量 |
| 5 | `routers/photos.py:30` | 上传无校验 | 大小+MIME 检查 |
| 6 | `index.html` | 无 CSP | 加 `<meta>` 标签 |
| 7 | `console.js:177` | 搜索 innerHTML | → DOM API |
| 8 | `schemas.py:8` | 弱密码 | `Field(min_length=8)` |

### 2. 功能搬运（旅行相册有，尚未搬）
- 照片查看器（`openPhotoViewer` + 翻页）
- 地点总览列表（`renderOverview`）

### 3. 体验优化
- `china_districts.geojson` 23MB 部署
- 移动端触摸优化

---

## 已知局限

- **SQLite 不适合并发**，多用户同时写会锁表，仅适合单用户 demo
- **照片服务无认证**（`/api/photos/file/{path}`），任何人拿到 URL 即可访问
- **JWT 默认密钥不安全**，上线必须设环境变量
- **无 HTTPS**，生产需 nginx 反代 + 证书
- **Three.js CDN 无 SRI**，CDN 被劫持即可注入恶意代码
- `_onDataReady` 可能触发两次，有 hasFill 守卫，无害但浪费
- 手势 demo 的悬浮卡片双击行为与旅行相册不同（旅行相册双击进编辑，demo 双击进详情）
