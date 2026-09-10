from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.models.schemas import StationResponse
from app.services.ocean_service import ocean_service

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("", response_model=list[StationResponse])
async def get_stations(
    region: Optional[str] = Query(None, description="Filter by region"),
):
    return ocean_service.get_stations(region=region)


@router.get("/frontend", response_model=None)
async def get_frontend_stations():
    """Stations in the format the 3D frontend expects (matching Station type)."""
    return ocean_service.get_all_station_details()


@router.get("/{station_id}", response_model=Optional[StationResponse])
async def get_station(station_id: str):
    station = ocean_service.get_station(station_id)
    if station is None:
        raise HTTPException(status_code=404, detail="Station not found")
    return station


@router.get("/{station_id}/detail", response_model=None)
async def get_station_detail(station_id: str):
    """Single station in the frontend-compatible format."""
    detail = ocean_service.get_station_detail(station_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Station not found")
    return detail
