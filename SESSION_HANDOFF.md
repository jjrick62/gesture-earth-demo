# 会话交接 — 2026-05-11

## 本日成果：安全修复第一阶段（全部 8 项完成）

| # | 文件 | 问题 | 方案 | 验证 |
|:--:|------|------|------|:--:|
| F1 | `js/card.js:53` | 存储型 XSS（place.name → innerHTML） | DOM API + textContent | 攻击脚本测试通过 |
| F2 | `js/main.js:15` | DOM XSS（fatal() msg → innerHTML） | DOM API + textContent | 攻击脚本测试通过 |
| F3 | `backend/storage.py` | 路径遍历（../可读写任意文件） | `_safe_path()` + realpath 前缀校验 | curl 攻击拦截 |
| F4 | `backend/config.py` | 默认 JWT 密钥 | `secrets.token_urlsafe(32)` 随机生成 | 源码审计通过 |
| F5 | `backend/routers/photos.py` | 上传无限制 | MIME 白名单 + 10MB 上限 | 非图片/超大文件 400 |
| F6 | `index.html` | 无 CSP | meta 标签（含 CDN WASM connect-src） | 源码审计通过 |
| F7 | `js/console.js:177` | 城市搜索 innerHTML | createTextNode + textContent | 攻击脚本测试通过 |
| F8 | `backend/schemas.py` | 密码无约束 | `Field(min_length=8)` + EmailStr | 弱密码/无效邮箱 422 |

### 攻击脚本验证结果：10/10 全部通过

路径遍历拦截、非图片文件拒绝、超大文件拒绝、弱密码 422、无效邮箱 422、XSS 代码清除、CSP 存在、密钥随机化、合法注册正常。

### 架构讨论

- **OOP 评估**：当前只有 Earth 是类，其他是函数模块。后续加照片管理/用户系统/分享时，用类封装新模块，渐进式过渡。
- **输入校验策略**：国际城市问题已讨论，后续引入 GeoNames 数据集统一走搜索匹配，彻底去掉自由输入。

### CSP 踩坑

初始 CSP `connect-src` 只允许 `localhost:8000`，导致 MediaPipe WASM 从 `cdn.jsdelivr.net` 加载被拦截（手势识别失效）。已修正为同时允许 CDN + `wasm-unsafe-eval`（WASM 编译需要）。

### 视角复位优化

用户反馈张开手掌旋转时视角总跳到固定位置。根因：palm 手势检测到 `_focusedPlaceId` 后先执行 `resetView()` 飞回地心。
- **mapper.js**：移除 palm 中的 `resetView()` 调用，张开手掌直接旋转，不跳视角
- **console.js**：关闭编辑弹窗不再强制 `zoomOutFromPlace`/`resetView`
- 保留：点击空白处复位、拖拽解锁聚焦（target→地心+摄像机原地）、重置视角按钮

### 捏合缩放灵敏度

`ZOOM_GAIN` 20→120，速度上限 ±0.3→±1.0，捏合缩放手感大幅提升。

### 旅行相册同步

安全修复全部 8 项 + 视角逻辑优化已同步到旅行相册项目并推送。改动文件：`storage.py, config.py, photos.py, schemas.py, requirements.txt, index.html, app.js`

## 下次任务（按优先级）

### P0: 国际城市数据集（GeoNames）
- 下载 `cities5000.txt`（全球 ~4.7 万城市，含中英文名/坐标/人口）
- 写脚本转成 `cities.json` 兼容格式
- 合并中国 3000 + 国际 ~5000 城市
- 搜索支持英文原名 + 中文音译
- **做完这个，自由输入彻底不需要了，输入端的 XSS 风险自然消除**

### P1: 安全修复第二阶段（7 项）
- F9: 注册频率限制（slowapi 或手写 IP 限流）
- F10: 登录暴力破解防护（连续失败 N 次锁定）
- F11: 邮箱验证（注册后发验证邮件）
- F12: 照片服务认证（`/api/photos/file/{path}` 加上 `get_current_user`）
- F13: 经纬度/评分/notes 输入范围约束（Pydantic `Field(ge=, le=)`）
- F14: UserLogin email 也改为 EmailStr
- F15: `window.API_BASE` 防 XSS 劫持

### P2: 功能搬运
- 照片查看器（`openPhotoViewer` + 翻页）
- 地点总览列表（`renderOverview`）

### P3: 其他
- `china_districts.geojson` 23MB 部署（区县级填充）
- 移动端触摸优化
- Session 过期后 401 自动重登流程优化

## 上次交接遗留上下文（2026-05-10）

### 一、卡片管理控制台（从旅行相册完整搬运）

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
