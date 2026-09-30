from fastapi import APIRouter, HTTPException, Path
from ..models import Media
from ..services.aggregator import aggregator

router = APIRouter(prefix="/v1/media", tags=["unified-media"])

@router.get("/{media_id:path}", response_model=Media)
async def get_media(media_id: str = Path(..., min_length=2)) -> Media:
    media = await aggregator.get_media(media_id)
    if media is None:
        raise HTTPException(status_code=404, detail=f"Media '{media_id}' not found")
    return media
