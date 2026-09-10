from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime
from app.services.ocean_service import ocean_service

router = APIRouter(prefix="/ocean", tags=["ocean"])


@router.get("/observations")
async def get_observations(
    parameter: Optional[str] = Query(None),
    depth: Optional[float] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
    limit: int = Query(100, le=1000),
):
    return ocean_service.get_observations(
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


@router.get("/model")
async def get_model_data(
    parameter: Optional[str] = Query(None),
    depth: Optional[float] = Query(None),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
    limit: int = Query(100, le=1000),
):
    return ocean_service.get_model_data(
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


@router.get("/timeseries")
async def get_timeseries(
    latitude: float = Query(...),
    longitude: float = Query(...),
    parameter: str = Query("temperature"),
    depth: float = Query(0),
    days: int = Query(7, le=90),
):
    return ocean_service.get_timeseries(
        latitude=latitude,
        longitude=longitude,
        parameter=parameter,
        depth=depth,
        days=days,
    )
