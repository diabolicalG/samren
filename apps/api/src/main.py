import os
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlmodel import Field, Relationship, Session, SQLModel, create_engine, select, func
import redis.asyncio as aioredis

# Environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/samren?schema=public",
)
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGIN", "http://localhost:3000").split(",") if origin.strip()]
SHIVRA_API_URL = os.getenv("SHIVRA_API_URL", "http://localhost:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
engine = create_engine(DATABASE_URL, echo=False)


def generate_uuid() -> str:
    return uuid4().hex


class UserRole(str, SQLModel):
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"


class User(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=generate_uuid, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(sa_column_kwargs={"unique": True, "index": True})
    hashed_password: str
    role: str = Field(default="user")
    avatar: Optional[str] = None
    preferences: str = Field(default="{}")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: Optional[datetime] = None

    favorites: List["AnimeListEntry"] = Relationship(back_populates="user")
    history: List["HistoryEntry"] = Relationship(back_populates="user")
    downloads: List["Download"] = Relationship(back_populates="user")


class AnimeListEntry(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=generate_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    anime_id: str = Field(index=True)
    status: str = Field(default="plan_to_watch")
    score: Optional[float] = None
    progress: int = Field(default=0)
    total_episodes: int = Field(default=0)
    repeat: int = Field(default=0)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="favorites")

    __table_args__ = (
        {"extend_existing": True},
    )


class HistoryEntry(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=generate_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    anime_id: str = Field(index=True)
    episode_id: str
    episode_number: int
    current_time: float
    duration: float
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="history")


class Download(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=generate_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    anime_id: str
    episode_id: str
    quality: str
    filename: str
    file_size: int
    status: str = Field(default="queued")
    progress: int = Field(default=0)
    path: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="downloads")


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str
    avatar: Optional[str]
    preferences: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    last_seen_at: Optional[datetime]

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PreferencesUpdate(BaseModel):
    player: Optional[str] = None
    preferred_quality: Optional[str] = None
    theme: Optional[str] = None
    autoplay: Optional[bool] = None
    auto_next: Optional[bool] = None
    auto_skip_intro: Optional[bool] = None
    auto_skip_outro: Optional[bool] = None
    language: Optional[str] = None
    subtitles: Optional[bool] = None
    dub: Optional[bool] = None
    save_download_path: Optional[str] = None


class HistoryCreate(BaseModel):
    anime_id: str
    episode_id: str
    episode_number: int
    current_time: float
    duration: float


class DownloadCreate(BaseModel):
    anime_id: str
    episode_id: str
    quality: str


app = FastAPI(
    title="Samren API",
    description="Samren - Anime streaming marketplace backend gateway",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(user_id: str, role: str) -> str:
    expires = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "type": "access", "exp": expires}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "type": "refresh", "exp": expires}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_user(session: Session, user_id: str) -> Optional[User]:
    return session.get(User, user_id)


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def authenticate_user(session: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(session, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if user_id is None or token_type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    user = get_user(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        admin = session.exec(select(User).where(User.role == "admin")).first()
        if not admin:
            hashed = get_password_hash("Admin123!")
            session.add(User(username="admin", email="admin@samren.local", hashed_password=hashed, role="admin"))
            session.commit()


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "Samren API"}


# --- Proxy helpers ---

async def _proxy_get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    cache_key = f"shivra:{path}:{json.dumps(params or {}, sort_keys=True)}"
    redis = await get_redis()
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{SHIVRA_API_URL}{path}", params=params)
        response.raise_for_status()
        data = response.json()

    await redis.set(cache_key, json.dumps(data), ex=300)
    return data


# --- Public anime endpoints (proxied to ShivraAPI with Redis cache) ---

@app.get("/api/anime")
async def list_anime(request: Request):
    params = dict(request.query_params)
    data = await _proxy_get("/anime", params)
    return data


@app.get("/api/anime/{anime_id}")
async def get_anime(anime_id: str):
    data = await _proxy_get(f"/anime/{anime_id}")
    return data


@app.get("/api/anime/{anime_id}/episodes")
async def get_episodes(anime_id: str):
    data = await _proxy_get(f"/anime/{anime_id}/episodes")
    return data


@app.get("/api/anime/{anime_id}/stream/{episode}")
async def get_stream(anime_id: str, episode: int, request: Request):
    params = dict(request.query_params)
    data = await _proxy_get(f"/anime/{anime_id}/stream/{episode}", params)
    return data


@app.get("/api/search")
async def search(request: Request):
    params = dict(request.query_params)
    data = await _proxy_get("/search", params)
    return data


@app.get("/api/top")
async def get_top(request: Request):
    params = dict(request.query_params)
    data = await _proxy_get("/top", params)
    return data


@app.get("/api/genres")
async def get_genres():
    data = await _proxy_get("/genres")
    return data


@app.get("/api/schedule")
async def get_schedule(request: Request):
    params = dict(request.query_params)
    data = await _proxy_get("/schedule", params)
    return data


# --- Auth endpoints ---

@app.post("/api/auth/register", response_model=UserRead)
def register(user_create: UserCreate, session: Session = Depends(get_session)) -> UserRead:
    if get_user_by_email(session, user_create.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        username=user_create.username,
        email=user_create.email,
        hashed_password=get_password_hash(user_create.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserRead.from_orm(user)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    user = authenticate_user(session, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    user.last_seen_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.commit()
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@app.post("/api/auth/refresh", response_model=TokenResponse)
def refresh_token(refresh_token: str, session: Session = Depends(get_session)) -> TokenResponse:
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if payload.get("type") != "refresh" or not user_id:
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = get_user(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
    )


@app.get("/api/auth/me", response_model=UserRead)
def get_profile(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.from_orm(current_user)


# --- User preferences ---

@app.get("/api/users/{user_id}/preferences")
def get_preferences(user_id: str, current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    prefs = json.loads(current_user.preferences or "{}")
    return {"success": True, "data": prefs}


@app.patch("/api/users/{user_id}/preferences")
def update_preferences(user_id: str, updates: PreferencesUpdate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> Dict[str, Any]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    prefs = json.loads(current_user.preferences or "{}")
    update_data = updates.dict(exclude_none=True)
    prefs.update(update_data)
    current_user.preferences = json.dumps(prefs)
    current_user.updated_at = datetime.utcnow()
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return {"success": True, "data": json.loads(current_user.preferences)}


# --- Favorites / Anime list ---

@app.get("/api/users/{user_id}/favorites")
def list_favorites(user_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> List[AnimeListEntry]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return session.exec(select(AnimeListEntry).where(AnimeListEntry.user_id == user_id).order_by(AnimeListEntry.created_at.desc())).all()


@app.post("/api/users/{user_id}/favorites")
def add_favorite(user_id: str, body: Dict[str, str], current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> Dict[str, str]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    anime_id = body.get("animeId")
    if not anime_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="animeId is required")
    existing = session.exec(select(AnimeListEntry).where(AnimeListEntry.user_id == user_id, AnimeListEntry.anime_id == anime_id)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already in favorites")
    entry = AnimeListEntry(user_id=user_id, anime_id=anime_id, status="plan_to_watch")
    session.add(entry)
    session.commit()
    return {"message": "added"}


@app.delete("/api/users/{user_id}/favorites/{anime_id}")
def remove_favorite(user_id: str, anime_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> Dict[str, str]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    entry = session.exec(select(AnimeListEntry).where(AnimeListEntry.user_id == user_id, AnimeListEntry.anime_id == anime_id)).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    session.delete(entry)
    session.commit()
    return {"message": "removed"}


# --- History ---

@app.get("/api/users/{user_id}/history")
def list_history(user_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> List[HistoryEntry]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return session.exec(select(HistoryEntry).where(HistoryEntry.user_id == user_id).order_by(HistoryEntry.created_at.desc())).all()


@app.post("/api/users/{user_id}/history")
def add_history(user_id: str, body: HistoryCreate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> HistoryEntry:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    entry = HistoryEntry(
        user_id=user_id,
        anime_id=body.anime_id,
        episode_id=body.episode_id,
        episode_number=body.episode_number,
        current_time=body.current_time,
        duration=body.duration,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


# --- Downloads ---

@app.get("/api/downloads/{user_id}")
def list_downloads(user_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> List[Download]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return session.exec(select(Download).where(Download.user_id == user_id).order_by(Download.created_at.desc())).all()


@app.post("/api/downloads")
def create_download(body: DownloadCreate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> Download:
    entry = Download(
        user_id=current_user.id,
        anime_id=body.anime_id,
        episode_id=body.episode_id,
        quality=body.quality,
        filename=f"samren_{body.anime_id}_ep{body.episode_id}_{body.quality}.mp4",
        file_size=0,
        status="queued",
        progress=0,
        path="",
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@app.delete("/api/downloads/cache/{user_id}")
def clear_downloads(user_id: str, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> Dict[str, str]:
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    downloads = session.exec(select(Download).where(Download.user_id == user_id)).all()
    for dl in downloads:
        session.delete(dl)
    session.commit()
    return {"message": "cleared"}


# --- Admin ---

@app.get("/api/admin/users")
def list_all_users(admin: User = Depends(require_admin), session: Session = Depends(get_session)) -> List[UserRead]:
    users = session.exec(select(User).order_by(User.created_at.desc())).all()
    return [UserRead.from_orm(user) for user in users]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=4000, reload=True)
