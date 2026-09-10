import logging
from typing import Optional
from datetime import datetime
from pathlib import Path

import pandas as pd

from app.models.schemas import ComparisonResponse
from app.config import settings

logger = logging.getLogger(__name__)


class ComparisonService:
    """Service for model-observation comparisons.

    Reads from the collocated dataset produced by the data pipeline.
    """

    def __init__(self):
        self._collocated: Optional[pd.DataFrame] = None
        self._load_data()

    def _load_data(self):
        collocated_path = settings.data_dir / "processed" / "collocated.parquet"
        if collocated_path.exists():
            try:
                self._collocated = pd.read_parquet(collocated_path)
                self._collocated["timestamp"] = pd.to_datetime(
                    self._collocated["timestamp"]
                )
                logger.info(
                    f"ComparisonService: loaded {self._collocated.shape[0]} records"
                )
            except Exception as e:
                logger.warning(f"Failed to load collocated data: {e}")
        else:
            logger.info("No collocated data available for comparisons.")

    def get_comparisons(
        self,
        parameter: str = "temperature",
        depth: Optional[float] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 100,
    ) -> list[ComparisonResponse]:
        if self._collocated is None:
            return []

        df = self._collocated.copy()

        if lat_min is not None:
            df = df[df["latitude"] >= lat_min]
        if lat_max is not None:
            df = df[df["latitude"] <= lat_max]
        if lon_min is not None:
            df = df[df["longitude"] >= lon_min]
        if lon_max is not None:
            df = df[df["longitude"] <= lon_max]
        if depth is not None:
            df = df[(df["depth"] >= depth - 20) & (df["depth"] <= depth + 20)]
        if start is not None:
            df = df[df["timestamp"] >= start]
        if end is not None:
            df = df[df["timestamp"] <= end]

        model_col = f"model_{parameter}"
        obs_col = f"observed_{parameter}"
        diff_col = f"{parameter}_difference"
        pct_col = f"{parameter}_pct_difference"

        if model_col not in df.columns or obs_col not in df.columns:
            return []

        df = df.dropna(subset=[model_col, obs_col])
        df = df.head(limit)

        results = []
        for _, row in df.iterrows():
            results.append(
                ComparisonResponse(
                    latitude=row["latitude"],
                    longitude=row["longitude"],
                    depth=row["depth"],
                    timestamp=row["timestamp"],
                    parameter=parameter,
                    model_value=float(row[model_col]),
                    observed_value=float(row[obs_col]),
                    difference=float(row[diff_col]) if diff_col in row and pd.notna(row.get(diff_col)) else None,
                    percentage_difference=float(row[pct_col]) if pct_col in row and pd.notna(row.get(pct_col)) else None,
                )
            )
        return results


comparison_service = ComparisonService()
