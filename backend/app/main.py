"""
main.py — FastAPI entry point for the EcoRoute backend.

Run:  python -m uvicorn app.main:app --port 8000   (from the backend/ folder)
Docs: http://localhost:8000/docs   (you can add / edit data from this page too)
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import db
from .models import (LocationCreate, LocationUpdate, OptimizeRequest, OverflowRequest,
                     VehicleCreate, VehicleUpdate)
from .service import run_optimisation, simulate_overflow


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_db()          # create tables + load sample data on first start
    yield


app = FastAPI(
    title="EcoRoute Optimisation API",
    version="1.1.0",
    description="Capacitated vehicle routing for waste collection (BuildX 0.1 – Challenge 05).",
    lifespan=lifespan,
)

# Allow the Vite dev server on ANY local port (5173, 5174, ...) plus any
# extra origins listed in the CORS_ORIGINS environment variable.
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ecoroute-optimiser"}


# ── Optimisation ─────────────────────────────────────────────────────────────
@app.post("/api/optimize", tags=["optimisation"])
def optimize(req: OptimizeRequest):
    try:
        result = run_optimisation(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    try:   # history is a bonus: never fail the optimisation because of it
        result["run_id"] = db.save_run(result, len(req.locations),
                                       sum(1 for v in req.vehicles if v.available))
    except Exception:  # noqa: BLE001
        result["run_id"] = None
    return result


@app.post("/api/simulate/overflow", tags=["optimisation"])
def overflow(req: OverflowRequest):
    return simulate_overflow(req)


# ── Database: locations ──────────────────────────────────────────────────────
@app.get("/api/locations", tags=["locations"])
def get_locations():
    return db.list_locations()


@app.post("/api/locations", status_code=201, tags=["locations"])
def add_location(loc: LocationCreate):
    try:
        return db.create_location(loc.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.put("/api/locations/{loc_id}", tags=["locations"])
def edit_location(loc_id: str, loc: LocationUpdate):
    if not db.get_location(loc_id):
        raise HTTPException(status_code=404, detail=f"Location {loc_id} not found")
    return db.update_location(loc_id, loc.model_dump(exclude_unset=True))


@app.delete("/api/locations/{loc_id}", tags=["locations"])
def remove_location(loc_id: str):
    if not db.delete_location(loc_id):
        raise HTTPException(status_code=404, detail=f"Location {loc_id} not found")
    return {"deleted": loc_id}


# ── Database: vehicles ───────────────────────────────────────────────────────
@app.get("/api/vehicles", tags=["vehicles"])
def get_vehicles():
    return db.list_vehicles()


@app.post("/api/vehicles", status_code=201, tags=["vehicles"])
def add_vehicle(v: VehicleCreate):
    try:
        return db.create_vehicle(v.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.put("/api/vehicles/{veh_id}", tags=["vehicles"])
def edit_vehicle(veh_id: str, v: VehicleUpdate):
    if not db.get_vehicle(veh_id):
        raise HTTPException(status_code=404, detail=f"Vehicle {veh_id} not found")
    return db.update_vehicle(veh_id, v.model_dump(exclude_unset=True))


@app.delete("/api/vehicles/{veh_id}", tags=["vehicles"])
def remove_vehicle(veh_id: str):
    if not db.delete_vehicle(veh_id):
        raise HTTPException(status_code=404, detail=f"Vehicle {veh_id} not found")
    return {"deleted": veh_id}


# ── Database: run history & admin ────────────────────────────────────────────
@app.get("/api/runs", tags=["history"])
def get_runs(limit: int = 50):
    return db.list_runs(max(1, min(limit, 500)))


@app.get("/api/runs/{run_id}", tags=["history"])
def get_run(run_id: int):
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run


@app.delete("/api/runs", tags=["history"])
def clear_runs():
    return {"deleted": db.clear_runs()}


@app.get("/api/db/stats", tags=["database"])
def db_stats():
    return db.stats()


@app.post("/api/db/reset", tags=["database"])
def db_reset():
    db.reset_to_sample()
    return db.stats()


# ── Production: serve the built React app from the same server ───────────────
# In the Docker image the frontend build is copied to STATIC_DIR, so one URL
# serves both the website and the API (no CORS or API URL setup needed).
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parent.parent / "static"))

if STATIC_DIR.is_dir():
    _root = STATIC_DIR.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (_root / full_path).resolve()
        if full_path and candidate.is_file() and _root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_root / "index.html")   # React Router handles the page
