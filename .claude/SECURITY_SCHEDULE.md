# 安全修复日程表 — gesture-earth-demo

> 审计日期：2026-05-10 | 发现问题 26 个 | 严重 2 / 高危 10 / 中危 10 / 低危 4

---

## 第一阶段：紧急修复（上线前必须修，预计 2h）

| # | 文件:行号 | 问题 | 修复方案 | 耗时 |
|---|---------|------|----------|:--:|
| F1 | `card.js:48-54` | 存储型 XSS（place.name → innerHTML） | `innerHTML` → DOM API + `textContent` | 15m |
| F2 | `main.js:15` | DOM XSS（fatal 函数 msg → innerHTML） | `innerHTML` → `textContent` | 5m |
| F3 | `storage.py:24,30` | 路径遍历（`..` 可读写任意文件） | `os.path.normpath` + 前缀校验 | 20m |
| F4 | `config.py:3` | 默认 JWT 密钥可被攻击者伪造 token | 启动时检查 `SECRET_KEY` 非默认值 | 10m |
| F5 | `routers/photos.py:30` | 上传无大小/类型限制 | 加 `file.size` 限制 + MIME 校验 | 20m |
| F6 | `index.html` | 无 CSP 策略 | 加 `<meta>` CSP 标签 | 15m |
| F7 | `console.js:177` | 城市搜索 innerHTML（供应链 XSS） | `innerHTML` → DOM API | 10m |
| F8 | `schemas.py:8` | 密码无复杂度约束 | `password: str` → `Field(min_length=8)` | 5m |

## 第二阶段：业务安全（上线后一周内，预计 3h）

| # | 文件:行号 | 问题 | 修复方案 | 耗时 |
|---|---------|------|----------|:--:|
| F9 | `routers/auth.py:12` | 注册无频率限制 | slowapi 或手写 IP 限流 | 30m |
| F10 | `routers/auth.py:31` | 登录无暴力破解防护 | 连续失败 N 次锁定 + 延迟 | 30m |
| F11 | `routers/auth.py:12` | 注册无邮箱验证 | 发送验证邮件 → 确认后激活 | 1h |
| F12 | `routers/photos.py:42` | 照片服务无认证 | 添加 `get_current_user` 依赖 | 15m |
| F13 | `schemas.py:47-63` | 经纬度/评分/notes 无范围约束 | Pydantic `Field(ge=, le=)` | 10m |
| F14 | `schemas.py:8` | email 无格式校验 | `str` → `EmailStr` | 10m |
| F15 | `api.js:3` | `window.API_BASE` 可被 XSS 劫持 | 移除 window 覆盖或加白名单 | 10m |

## 第三阶段：架构加固（有空就做，预计 4h）

| # | 文件:行号 | 问题 | 修复方案 | 耗时 |
|---|---------|------|----------|:--:|
| F16 | `config.py:5` | token 过期 7 天太长 | 缩短到 15min + refresh token | 1h |
| F17 | `auth.py:23` | 无 token 吊销机制 | token 黑名单表或 Redis | 1h |
| F18 | `main.py` | 无 HTTPS 强制 / 安全头 | SecureHeaders 中间件 | 30m |
| F19 | `config.py:8` | SQLite 文件可能被下载 | 确保 DB 不在静态目录 + PostgreSQL 迁移 | 1h |
| F20 | `storage.py:12` | 无磁盘配额控制 | 按 user 统计 + 上限拦截 | 30m |
| F21 | `models.py:23-24` | 邮箱/哈希未加密存储 | 应用层 AES 或 SQLCipher | 1h |
| F22 | `database.py:4` | SQLite 并发写锁 | WAL 模式 + busy_timeout | 15m |
| F23 | `console.js:449` | 客户端照片无大小验证 | `file.size > 10MB` + MIME 检查 | 10m |
| F24 | `earth.js:486` | user name 用于 includes 匹配 | 限制 place.name 最大长度 100 | 5m |
| F25 | `api.js:109,162` | 照片 URL 路径拼接无校验 | `new URL(p.url, API_BASE)` | 10m |
| F26 | `auth.py:30` | JWT 异常全部吞没 | 区分过期 vs 格式错误 | 15m |

---

## 修复顺序建议

```
第一周：F1→F4 (XSS + 密钥) → F5→F8 (上传 + CSP + 密码)
第二周：F9→F12 (频率限制 + 认证) → F13→F15 (输入校验)
有空时：F16→F22 (架构加固) → F23→F26 (低优先级)
```
