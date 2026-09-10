from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime
from app.services.comparison_service import comparison_service
from app.models.schemas import ComparisonResponse

router = APIRouter(prefix="/ocean", tags=["comparison"])


@router.get("/comparison", response_model=list[ComparisonResponse])
async def get_comparisons(
    parameter: str = Query("temperature"),
    depth: Optional[float] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
    limit: int = Query(100, le=1000),
):
    return comparison_service.get_comparisons(
        parameter=parameter,
        depth=depth,
        start=start,
        end=end,
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        limit=limit,
    )
