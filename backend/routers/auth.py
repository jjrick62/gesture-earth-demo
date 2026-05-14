from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User, UserMeta
from schemas import UserRegister, UserLogin, TokenResponse, UserOut
from auth import hash_password, verify_password, create_access_token, get_current_user
from rate_limit import check as rate_check

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister, request: Request, db: AsyncSession = Depends(get_db)):
    # 频率限制：每个 IP 每小时最多 5 次注册
    client_ip = request.client.host if request.client else "unknown"
    allowed, info = rate_check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"注册过于频繁，请等待 {info} 秒后再试"
        )

    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已注册")

    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 创建默认 meta
    db.add(UserMeta(user_id=user.id))
    await db.commit()

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # 账号不存在 → 模糊提示，不暴露是否存在
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    # 检查是否被锁定
    from datetime import datetime, timedelta
    if user.locked_until and user.locked_until > datetime.utcnow():
        wait_minutes = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"账号已被临时锁定（连续登录失败过多），请等待 {wait_minutes} 分钟后再试"
        )

    if not verify_password(body.password, user.password_hash):
        # 密码错误：递增失败计数
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        await db.commit()
        remaining = MAX_LOGIN_ATTEMPTS - user.failed_login_count
        if remaining > 0:
            raise HTTPException(status_code=401, detail=f"邮箱或密码错误（剩余 {remaining} 次尝试）")
        else:
            raise HTTPException(
                status_code=429,
                detail=f"账号已被临时锁定，请等待 {LOCKOUT_MINUTES} 分钟后重试"
            )

    # 登录成功：重置失败计数
    if user.failed_login_count:
        user.failed_login_count = 0
        user.locked_until = None
        await db.commit()

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
