"""Sample TomTom traffic flow at every corridor point and store it in Mongo `traffic_samples`.

Runs every 30 minutes from .github/workflows/collect.yml.
Needs TOMTOM_API_KEY and MONGO_URI (env vars, or the repo-root .env when run locally).
"""
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"


def load_dotenv(path: Path) -> None:
    """Fill missing env vars from KEY=value lines; real env vars win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def load_points() -> list[tuple[str, dict]]:
    doc = json.loads((ROOT / "ml" / "corridors.json").read_text())
    return [(c["id"], p) for c in doc["corridors"] for p in c["points"]]


def to_sample(corridor: str, point: dict, payload: dict, ts: datetime) -> dict | None:
    """Turn a flowSegmentData response into one stored sample, or None if it has no usable speeds."""
    flow = payload.get("flowSegmentData") or {}
    current, free = flow.get("currentSpeed"), flow.get("freeFlowSpeed")
    if not current or not free:
        return None
    return {
        "point_id": point["id"],
        "corridor": corridor,
        "ts": ts,
        "current_speed": current,  # km/h
        "free_flow_speed": free,  # km/h
        "current_travel_time": flow.get("currentTravelTime"),  # s
        "free_flow_travel_time": flow.get("freeFlowTravelTime"),  # s
        "confidence": flow.get("confidence"),
        "road_closure": bool(flow.get("roadClosure", False)),
        "frc": flow.get("frc"),
    }


def fetch_flow(point: dict, key: str, tls: ssl.SSLContext) -> dict:
    query = urllib.parse.urlencode({"point": f"{point['lat']},{point['lng']}", "unit": "KMPH", "key": key})
    with urllib.request.urlopen(f"{FLOW_URL}?{query}", timeout=15, context=tls) as res:
        return json.load(res)


def main() -> int:
    load_dotenv(ROOT / ".env")
    key, mongo_uri = os.environ.get("TOMTOM_API_KEY"), os.environ.get("MONGO_URI")
    if not key or not mongo_uri:
        print("TOMTOM_API_KEY and MONGO_URI are required", file=sys.stderr)
        return 1

    import certifi  # python.org builds on macOS ship without CA certificates

    tls = ssl.create_default_context(cafile=certifi.where())
    ts = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    samples, failures = [], []
    for corridor, point in load_points():
        try:
            sample = to_sample(corridor, point, fetch_flow(point, key, tls), ts)
            if sample:
                samples.append(sample)
            else:
                failures.append(f"{point['id']}: no speeds")
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            # Never log the URL: it carries the API key.
            failures.append(f"{point['id']}: {getattr(error, 'code', '')} {type(error).__name__}")
        time.sleep(0.25)  # stay well under TomTom's queries-per-second limit

    if samples:
        from pymongo import ASCENDING, MongoClient

        db = MongoClient(mongo_uri, tlsCAFile=certifi.where()).get_default_database()
        db.traffic_samples.create_index([("point_id", ASCENDING), ("ts", ASCENDING)], unique=True)
        db.traffic_samples.insert_many(samples, ordered=False)

    print(f"{ts.isoformat()} stored {len(samples)} samples, {len(failures)} failed")
    for failure in failures:
        print("  " + failure)
    return 0 if samples else 1


if __name__ == "__main__":
    sys.exit(main())
