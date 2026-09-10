import numpy as np
from typing import Optional


def percentage_difference(observed: Optional[float], model: Optional[float]) -> Optional[float]:
    if observed is None or model is None:
        return None
    if model == 0:
        return None
    return ((observed - model) / abs(model)) * 100.0


def absolute_difference(observed: Optional[float], model: Optional[float]) -> Optional[float]:
    if observed is None or model is None:
        return None
    return observed - model


def rmse(errors: np.ndarray) -> float:
    return float(np.sqrt(np.nanmean(errors ** 2)))


def mae(errors: np.ndarray) -> float:
    return float(np.nanmean(np.abs(errors)))


def mean_bias(errors: np.ndarray) -> float:
    return float(np.nanmean(errors))


def median_absolute_error(errors: np.ndarray) -> float:
    return float(np.nanmedian(np.abs(errors)))


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two lat/lon points."""
    R = 6371.0
    lat1_r, lat2_r = np.radians(lat1), np.radians(lat2)
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1_r) * np.cos(lat2_r) * np.sin(dlon / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c
