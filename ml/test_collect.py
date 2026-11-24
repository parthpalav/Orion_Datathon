"""Run with: python3 ml/test_collect.py (no third-party packages needed)."""
from datetime import datetime, timezone

from collect import load_points, to_sample

TS = datetime(2026, 11, 24, 3, 30, tzinfo=timezone.utc)
POINT = {"id": "weh-1", "lng": 72.86, "lat": 19.22}


def test_to_sample_maps_tomtom_fields():
    payload = {"flowSegmentData": {"frc": "FRC1", "currentSpeed": 22, "freeFlowSpeed": 55,
                                   "currentTravelTime": 120, "freeFlowTravelTime": 48,
                                   "confidence": 0.95, "roadClosure": False}}
    sample = to_sample("weh", POINT, payload, TS)
    assert sample == {"point_id": "weh-1", "corridor": "weh", "ts": TS, "current_speed": 22,
                      "free_flow_speed": 55, "current_travel_time": 120, "free_flow_travel_time": 48,
                      "confidence": 0.95, "road_closure": False, "frc": "FRC1"}


def test_to_sample_skips_responses_without_speeds():
    assert to_sample("weh", POINT, {}, TS) is None
    assert to_sample("weh", POINT, {"flowSegmentData": {"currentSpeed": 0, "freeFlowSpeed": 50}}, TS) is None


def test_corridor_points_fit_the_free_daily_budget():
    points = load_points()
    assert len({p["id"] for _, p in points}) == len(points), "point ids must be unique"
    assert len(points) * 48 <= 2500, "every-30-minute sampling must stay under 2,500 TomTom calls a day"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
