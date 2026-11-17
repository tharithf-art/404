"""Database / CRUD API tests."""
from fastapi.testclient import TestClient

from app.main import app


def _client():
    c = TestClient(app)
    c.__enter__()            # runs lifespan -> init_db
    c.post("/api/db/reset")
    return c


def test_seeded_with_sample_scenario():
    c = _client()
    s = c.get("/api/db/stats").json()
    assert s["locations"] == 20 and s["vehicles"] == 3
    assert sum(l["waste_kg"] for l in c.get("/api/locations").json()) == 4800


def test_location_crud():
    c = _client()
    r = c.post("/api/locations", json={"name": "Test Point", "lat": 6.91, "lng": 79.86,
                                       "waste_kg": 150, "priority": "High"})
    assert r.status_code == 201
    loc = r.json()
    assert loc["id"] == "LOC-021"
    r = c.put(f"/api/locations/{loc['id']}", json={"waste_kg": 175, "overflow": True})
    assert r.json()["waste_kg"] == 175 and r.json()["overflow"] is True
    assert c.delete(f"/api/locations/{loc['id']}").status_code == 200
    assert c.delete(f"/api/locations/{loc['id']}").status_code == 404


def test_location_validation():
    c = _client()
    assert c.post("/api/locations", json={"name": "", "lat": 6.9, "lng": 79.8, "waste_kg": 1}).status_code == 422
    assert c.post("/api/locations", json={"name": "X", "lat": 99, "lng": 79.8, "waste_kg": 1}).status_code == 422
    assert c.post("/api/locations", json={"name": "X", "lat": 6.9, "lng": 79.8, "waste_kg": -5}).status_code == 422
    assert c.post("/api/locations", json={"id": "LOC-001", "name": "Dup", "lat": 6.9, "lng": 79.8,
                                          "waste_kg": 5}).status_code == 409
    assert c.put("/api/locations/NOPE", json={"waste_kg": 5}).status_code == 404


def test_vehicle_crud():
    c = _client()
    v = c.post("/api/vehicles", json={"capacity_kg": 2000, "type": "Tipper"}).json()
    assert v["id"] == "V004" and v["available"] is True and v["color"].startswith("#")
    assert c.put("/api/vehicles/V004", json={"available": False}).json()["available"] is False
    assert c.post("/api/vehicles", json={"capacity_kg": 0}).status_code == 422
    assert c.delete("/api/vehicles/V004").status_code == 200


def test_optimisation_runs_are_saved():
    c = _client()
    c.delete("/api/runs")
    body = {"locations": c.get("/api/locations").json(), "vehicles": c.get("/api/vehicles").json(),
            "settings": {"time_budget_ms": 200}}
    r = c.post("/api/optimize", json=body).json()
    assert r["run_id"]
    runs = c.get("/api/runs").json()
    assert len(runs) == 1 and runs[0]["n_locations"] == 20
    full = c.get(f"/api/runs/{r['run_id']}").json()
    assert full["result"]["optimised_distance_km"] == r["optimised_distance_km"]
