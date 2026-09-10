import time
import random
from fastapi import APIRouter, Header, HTTPException, status

router = APIRouter(prefix="/v1/argo", tags=["argo-live"])

VALID_API_KEY = "samudra_live_key_2026_xYz"
_tick_counter = 0

@router.get("/live")
async def get_argo_live_stream(
    x_api_key: str = Header(None, alias="X-API-KEY"),
    api_key: str = None
):
    global _tick_counter
    effective_key = x_api_key or api_key
    if not effective_key or effective_key != VALID_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Check the X-API-KEY value."
        )

    _tick_counter += 1
    
    # Generate dynamic realistic Argo profile data tick
    temp = round(27.5 + random.uniform(-1.5, 1.5), 2)
    sal = round(34.2 + random.uniform(-0.5, 0.5), 2)
    wave = round(1.2 + random.uniform(-0.4, 0.6), 2)
    current = round(0.45 + random.uniform(-0.15, 0.25), 2)
    
    statuses = ["normal", "normal", "normal", "warning", "critical"]
    status_choice = random.choice(statuses)

    return {
        "tick": _tick_counter,
        "profile_id": f"ARGO-590623-{_tick_counter}",
        "region": "Bay of Bengal",
        "latitude": round(15.4 + random.uniform(-0.5, 0.5), 4),
        "longitude": round(88.2 + random.uniform(-0.5, 0.5), 4),
        "timestamp": int(time.time()),
        "station_payload": {
            "temperature": temp,
            "salinity": sal,
            "waveHeight": wave,
            "currentSpeed": current,
            "anomalyStatus": status_choice
        }
    }
