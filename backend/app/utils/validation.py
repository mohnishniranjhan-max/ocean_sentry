import numpy as np
from typing import Optional


def is_valid_coordinate(lat: float, lon: float) -> bool:
    if lat < -90 or lat > 90:
        return False
    if lon < -180 or lon > 360:
        return False
    return True


def is_valid_depth(depth: float) -> bool:
    return 0 <= depth <= 11000


def is_valid_temperature(temp: float) -> bool:
    return -3.0 <= temp <= 45.0


def is_valid_salinity(sal: float) -> bool:
    return 0.0 <= sal <= 45.0


def is_valid_timestamp(ts) -> bool:
    if ts is None:
        return False
    if hasattr(ts, 'year'):
        return 1900 <= ts.year <= 2100
    return False


def filter_nan(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    return float(value)
