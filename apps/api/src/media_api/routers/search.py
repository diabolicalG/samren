from typing import List, Optional
from fastapi import APIRouter, Query
from ..models import MediaType, SearchResult
from ..services.aggregator import aggregator

router = APIRouter(prefix="/v1", tags=["unified-search"])

@router.get("/search", response_model=SearchResult)
async def search(q: str = Query(..., min_length=1, max_length=200), type: Optional[List[MediaType]] = Query(None), limit: int = Query(20, ge=1, le=50)) -> SearchResult:
    items = await aggregator.search(q, type, limit)
    return SearchResult(query=q, total=len(items), items=items)
