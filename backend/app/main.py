"""
main.py — FastAPI entry point for the EcoRoute optimisation backend.

Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ folder)
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import OptimizeRequest, OverflowRequest
from .service import run_optimisation, simulate_overflow

app = FastAPI(
    title="EcoRoute Optimisation API",
    version="1.0.0",
    description="Capacitated vehicle routing for waste collection (BuildX 0.1 – Challenge 05).",
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ecoroute-optimiser"}


@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    try:
        return run_optimisation(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/simulate/overflow")
def overflow(req: OverflowRequest):
    return simulate_overflow(req)
