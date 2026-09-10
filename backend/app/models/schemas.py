from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum


class AnomalyStatus(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    HIGH = "high"


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "ocean-sentry-api"
    device_info: Optional[dict] = None


class OceanStatusResponse(BaseModel):
    data_sources: list[str] = []
    last_updated: Optional[datetime] = None
    status: str = "prototype"
    device_info: Optional[dict] = None



class OceanObservation(BaseModel):
    id: str
    source: str
    timestamp: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=360)
    depth: float = Field(ge=0)
    temperature: Optional[float] = None
    salinity: Optional[float] = None
    wave_height: Optional[float] = None
    current_u: Optional[float] = None
    current_v: Optional[float] = None
    ph: Optional[float] = None
    chlorophyll: Optional[float] = None
    quality_flag: Optional[int] = None


class OceanModelState(BaseModel):
    source: str
    timestamp: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=360)
    depth: float = Field(ge=0)
    temperature: Optional[float] = None
    salinity: Optional[float] = None
    current_u: Optional[float] = None
    current_v: Optional[float] = None
    wave_height: Optional[float] = None
    sea_level: Optional[float] = None
    ph: Optional[float] = None
    chlorophyll: Optional[float] = None


class CollocationRecord(BaseModel):
    timestamp: datetime
    latitude: float
    longitude: float
    depth: float

    model_temperature: Optional[float] = None
    observed_temperature: Optional[float] = None
    temperature_difference: Optional[float] = None

    model_salinity: Optional[float] = None
    observed_salinity: Optional[float] = None
    salinity_difference: Optional[float] = None

    model_ph: Optional[float] = None
    observed_ph: Optional[float] = None
    ph_difference: Optional[float] = None

    model_current_u: Optional[float] = None
    model_current_v: Optional[float] = None
    observed_current_u: Optional[float] = None
    observed_current_v: Optional[float] = None

    model_chlorophyll: Optional[float] = None
    observed_chlorophyll: Optional[float] = None
    chlorophyll_difference: Optional[float] = None

    observation_quality: Optional[int] = None


class AnomalyResult(BaseModel):
    station_id: Optional[str] = None
    latitude: float
    longitude: float
    depth: float
    timestamp: datetime
    parameter: str
    model_value: Optional[float] = None
    observed_value: Optional[float] = None
    difference: Optional[float] = None
    anomaly_score: float = Field(ge=0, le=1)
    status: AnomalyStatus
    confidence: float = Field(ge=0, le=1)


class ComparisonResponse(BaseModel):
    latitude: float
    longitude: float
    depth: float
    timestamp: datetime
    parameter: str
    model_value: Optional[float] = None
    observed_value: Optional[float] = None
    difference: Optional[float] = None
    percentage_difference: Optional[float] = None


class TrajectoryPoint(BaseModel):
    latitude: float
    longitude: float
    depth: float
    timestamp: Optional[datetime] = None


class StationResponse(BaseModel):
    id: str
    name: str
    type: str
    latitude: float
    longitude: float
    depth: float
    last_update: Optional[datetime] = None
    status: AnomalyStatus = AnomalyStatus.NORMAL
    is_online: bool = True
    trajectory: Optional[list[TrajectoryPoint]] = None


class PredictionRequest(BaseModel):
    features: dict


class PredictionResponse(BaseModel):
    anomaly_score: float
    status: AnomalyStatus
    confidence: float = Field(ge=0, le=1, default=0.5)


class DataIngestionReport(BaseModel):
    source: str
    records_received: int
    records_valid: int
    records_removed: int
    records_missing: int
    variables_found: list[str]
    time_range: Optional[tuple[str, str]] = None
    lat_range: Optional[tuple[float, float]] = None
    lon_range: Optional[tuple[float, float]] = None
    depth_range: Optional[tuple[float, float]] = None
    detected_delimiter: Optional[str] = None
    column_mapping: dict[str, str] = Field(default_factory=dict)
    rejected_rows: list[dict] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    station_ids: list[str] = Field(default_factory=list)


class AsciiIngestRequest(BaseModel):
    text_content: str
    source_name: Optional[str] = "ascii_manual_upload"
    station_id_override: Optional[str] = None
    delimiter_override: Optional[str] = None


class AsciiPreviewResponse(BaseModel):
    success: bool
    report: DataIngestionReport
    preview_records: list[dict] = Field(default_factory=list)
    detected_delimiter: str
    column_mapping: dict[str, str]
    header_metadata: dict[str, str] = Field(default_factory=dict)


class AsciiIngestResponse(BaseModel):
    success: bool
    message: str
    report: DataIngestionReport
    created_stations: list[str] = Field(default_factory=list)

