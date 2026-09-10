from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime
from app.services.ml_service import ml_service
from app.services.anomaly_service import anomaly_service
from app.models.schemas import PredictionRequest, PredictionResponse

router = APIRouter(tags=["anomalies"])


@router.get("/ocean/anomalies")
async def get_anomalies(
    parameter: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    depth_min: Optional[float] = Query(None),
    depth_max: Optional[float] = Query(None),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    limit: int = Query(50, le=500),
):
    return anomaly_service.get_anomalies(
        parameter=parameter,
        status=status,
        depth_min=depth_min,
        depth_max=depth_max,
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )


@router.get("/ocean/anomalies/summary")
async def get_anomaly_summary():
    return anomaly_service.get_summary()


@router.post("/ml/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    return ml_service.predict(request.features)
