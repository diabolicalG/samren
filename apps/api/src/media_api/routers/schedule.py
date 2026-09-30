from datetime import date as date_type
from typing import List
from fastapi import APIRouter, Query
from ..models import Media
from ..services.aggregator import aggregator

router = APIRouter(prefix="/v1", tags=["unified-schedule"])

@router.get("/schedule", response_model=List[Media])
async def schedule(date: str = Query(..., min_length=10, max_length=10), country: str = Query("KE", min_length=2, max_length=2)) -> List[Media]:
    try:
        date_type.fromisoformat(date)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
    return await aggregator.schedule(date, country.upper())
