"""Tests for the optimiser: feasibility, capacity, priorities, baseline comparison, API validation."""
import json
import random
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import OptimizeRequest
from app.service import run_optimisation

DATA = json.loads((Path(__file__).parent.parent / "data" / "sample_scenario.json").read_text())
client = TestClient(app)


def _req(locations=None, vehicles=None, **settings):
    return OptimizeRequest(
        locations=locations or DATA["locations"],
        vehicles=vehicles or DATA["vehicles"],
        settings={"time_budget_ms": 400, **settings},
    )


def _random_locations(n, seed, total_scale=1.0):
    rng = random.Random(seed)
    return [{
        "id": f"R{i:03d}", "name": f"Random {i}",
        "lat": 6.90 + rng.random() * 0.03, "lng": 79.855 + rng.random() * 0.03,
        "waste_kg": round(rng.uniform(80, 400) * total_scale),
        "priority": rng.choice(["High", "Medium", "Low"]),
    } for i in range(n)]


def _check_invariants(res, locations, vehicles):
    caps = {v["id"]: v["capacity_kg"] for v in vehicles}
    waste = {l["id"]: l["waste_kg"] for l in locations}
    seen = []
    for r in res["routes"]:
        load = sum(waste[s] for s in r["stops"])
        assert load <= caps[r["vehicle_id"]] + 1e-6, "capacity violated"
        assert abs(load - r["total_waste_kg"]) < 0.5
        seen += r["stops"]
    assert len(seen) == len(set(seen)), "location visited twice"
    all_ids = {l["id"] for l in locations if l["waste_kg"] > 0}
    assert set(seen) | set(res["unserviced"]) == all_ids, "location lost"
    assert set(seen).isdisjoint(res["unserviced"])
    for s in res["strategies"]:
        assert s["feasible"], f"{s['key']} infeasible"


def test_sample_scenario_all_served_and_better_than_baseline():
    res = run_optimisation(_req())
    _check_invariants(res, DATA["locations"], DATA["vehicles"])
    assert res["unserviced"] == []
    assert len(res["routes"]) == 3
    assert res["optimised_distance_km"] < res["baseline_distance_km"]
    # schedule is time-ordered
    for r in res["routes"]:
        arr = [s["arrival_min"] for s in r["schedule"]]
        assert arr == sorted(arr)


@pytest.mark.parametrize("seed", range(8))
def test_random_instances_invariants(seed):
    locs = _random_locations(25, seed)
    vehicles = [{"id": "A", "capacity_kg": 1200}, {"id": "B", "capacity_kg": 2000},
                {"id": "C", "capacity_kg": 2500}]
    res = run_optimisation(_req(locs, vehicles, seed=seed))
    _check_invariants(res, locs, vehicles)
    opt = next(s for s in res["strategies"] if s["key"] == "optimised")
    base = next(s for s in res["strategies"] if s["key"] == "baseline")
    # optimiser never collects less waste than the baseline
    assert opt["serviced_kg"] >= base["serviced_kg"] - 1e-6


def test_overloaded_fleet_reports_unserviced_and_protects_high_priority():
    locs = _random_locations(30, 99, total_scale=1.6)  # far more waste than capacity
    vehicles = [{"id": "A", "capacity_kg": 1000}, {"id": "B", "capacity_kg": 1500},
                {"id": "C", "capacity_kg": 3000}]
    res = run_optimisation(_req(locs, vehicles))
    _check_invariants(res, locs, vehicles)
    assert res["unserviced"], "expected unserviced locations"
    assert all(u["reason"] for u in res["unserviced_details"])
    pri = {l["id"]: l["priority"] for l in locs}
    uns = [pri[u] for u in res["unserviced"]]
    # Low/Medium are dropped before High
    assert uns.count("High") <= min(uns.count("Low"), uns.count("Medium")) or "High" not in uns


def test_location_bigger_than_any_vehicle():
    locs = DATA["locations"] + [{"id": "BIG", "name": "Huge", "lat": 6.91, "lng": 79.86,
                                 "waste_kg": 5000, "priority": "High"}]
    res = run_optimisation(_req(locs))
    assert "BIG" in res["unserviced"]
    big = next(u for u in res["unserviced_details"] if u["id"] == "BIG")
    assert "largest available vehicle" in big["reason"]


def test_unavailable_vehicle_is_not_used():
    vehicles = [dict(v) for v in DATA["vehicles"]]
    vehicles[2]["available"] = False
    res = run_optimisation(_req(vehicles=vehicles))
    assert res["unavailable_vehicles"] == ["V003"]
    assert all(r["vehicle_id"] != "V003" for r in res["routes"])
    _check_invariants(res, DATA["locations"], [v for v in vehicles if v.get("available", True)])
    assert res["unserviced"]  # 4,800 kg cannot fit in 2,500 kg


def test_overflow_location_treated_as_high_priority():
    locs = [dict(l) for l in DATA["locations"]]
    locs[3]["overflow"] = True  # LOC-004 is Low
    res = run_optimisation(_req(locs))
    stop = next(s for r in res["routes"] for s in r["schedule"] if s["location_id"] == "LOC-004")
    assert stop["effective_priority"] == "High"


def test_deterministic_with_seed():
    a = run_optimisation(_req(seed=7, time_budget_ms=5000))
    b = run_optimisation(_req(seed=7, time_budget_ms=5000))
    assert [r["stops"] for r in a["routes"]] == [r["stops"] for r in b["routes"]]


# ── API ──────────────────────────────────────────────────────────────────────
def test_api_health():
    assert client.get("/health").json()["status"] == "ok"


def test_api_optimize_ok():
    r = client.post("/api/optimize", json={"locations": DATA["locations"], "vehicles": DATA["vehicles"],
                                           "settings": {"time_budget_ms": 300}})
    assert r.status_code == 200
    assert r.json()["status"] == "success"


@pytest.mark.parametrize("bad", [
    {"locations": [], "vehicles": DATA["vehicles"]},
    {"locations": DATA["locations"], "vehicles": [{"id": "X", "capacity_kg": -5}]},
    {"locations": [{**DATA["locations"][0], "lat": 200}], "vehicles": DATA["vehicles"]},
    {"locations": [DATA["locations"][0], DATA["locations"][0]], "vehicles": DATA["vehicles"]},
    {"locations": DATA["locations"], "vehicles": [{"id": "X", "capacity_kg": 100, "available": False}]},
    {"locations": DATA["locations"], "vehicles": DATA["vehicles"], "settings": {"shift_start": "25:00"}},
])
def test_api_rejects_invalid_input(bad):
    assert client.post("/api/optimize", json=bad).status_code == 422


def test_api_overflow_simulation():
    r = client.post("/api/simulate/overflow", json={"locations": DATA["locations"], "seed": 1,
                                                    "probability": 0.5})
    body = r.json()
    assert r.status_code == 200 and body["simulated"]
    for ch in body["changed"]:
        assert ch["to_kg"] >= ch["from_kg"]
