from fastapi import APIRouter
from .routers.media import router as media_router
from .routers.schedule import router as schedule_router
from .routers.search import router as search_router
from .routers.trending import router as trending_router

router = APIRouter()
router.include_router(search_router)
router.include_router(media_router)
router.include_router(trending_router)
router.include_router(schedule_router)
