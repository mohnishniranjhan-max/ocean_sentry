from fastapi import APIRouter
from app.models.schemas import HealthResponse, OceanStatusResponse
from app.services.ocean_service import ocean_service
from app.services.ml_service import ml_service

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(device_info=ml_service.get_device_info())


@router.get("/ml/device")
async def get_device_telemetry():
    """Returns real-time GPU/CPU execution hardware metrics."""
    return ml_service.get_device_info()


@router.get("/ocean/status", response_model=OceanStatusResponse)
async def ocean_status():
    source = ocean_service._model_source
    if source == "copernicus":
        data_sources = ["INCOIS Ocean Monitoring", "Copernicus Marine (Optional)", "Argo Float Observations"]
        status = "operational"
    else:
        data_sources = ["Prototype Ocean Model (Synthetic)", "Real Argo Observations"]
        status = "prototype"

    last_updated = None
    if ocean_service._collocated is not None and not ocean_service._collocated.empty:
        last_updated = ocean_service._collocated["timestamp"].max()

    return OceanStatusResponse(
        data_sources=data_sources,
        last_updated=last_updated,
        status=status,
        device_info=ml_service.get_device_info(),
    )

