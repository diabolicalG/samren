from typing import List, Optional
from fastapi import APIRouter, Query
from ..models import Media, MediaType
from ..services.aggregator import aggregator

router = APIRouter(prefix="/v1", tags=["unified-trending"])

@router.get("/trending", response_model=List[Media])
async def trending(type: Optional[List[MediaType]] = Query(None), limit: int = Query(20, ge=1, le=50)) -> List[Media]:
    return await aggregator.trending(type, limit)
