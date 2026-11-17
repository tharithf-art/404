"""
models.py — request / response schemas with input validation (Pydantic v2).
"""
from __future__ import annotations

import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

Priority = Literal["High", "Medium", "Low"]


class LocationIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(default="", max_length=200)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    waste_kg: float = Field(ge=0, le=100_000)
    priority: Priority = "Medium"
    overflow: bool = False  # simulated overflowing bin -> treated as High priority


class VehicleIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    capacity_kg: float = Field(gt=0, le=100_000)
    available: bool = True
    type: Optional[str] = None


class DepotIn(BaseModel):
    name: str = "Depot"
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class SettingsIn(BaseModel):
    shift_start: str = "06:00"
    avg_speed_kmh: float = Field(default=20.0, gt=1, le=120)
    service_min_base: float = Field(default=3.0, ge=0, le=120)
    service_min_per_100kg: float = Field(default=2.0, ge=0, le=120)
    max_shift_min: float = Field(default=480.0, gt=0, le=1440)
    road_factor: float = Field(default=1.3, ge=1.0, le=3.0)
    priority_aware: bool = True
    time_budget_ms: int = Field(default=1500, ge=50, le=20_000)
    seed: int = 42

    @field_validator("shift_start")
    @classmethod
    def _check_time(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError("shift_start must be HH:MM (24h)")
        return v


DEFAULT_DEPOT = DepotIn(
    name="CMC Depot (approx. Town Hall, Colombo 07) – assumed location",
    lat=6.9167,
    lng=79.8636,
)


class OptimizeRequest(BaseModel):
    locations: List[LocationIn] = Field(min_length=1, max_length=500)
    vehicles: List[VehicleIn] = Field(min_length=1, max_length=50)
    depot: Optional[DepotIn] = None
    settings: SettingsIn = SettingsIn()

    @model_validator(mode="after")
    def _unique_and_available(self):
        loc_ids = [l.id for l in self.locations]
        if len(set(loc_ids)) != len(loc_ids):
            raise ValueError("Location ids must be unique")
        veh_ids = [v.id for v in self.vehicles]
        if len(set(veh_ids)) != len(veh_ids):
            raise ValueError("Vehicle ids must be unique")
        if not any(v.available for v in self.vehicles):
            raise ValueError("At least one vehicle must be available")
        if self.depot is None:
            self.depot = DEFAULT_DEPOT
        return self


class OverflowRequest(BaseModel):
    locations: List[LocationIn] = Field(min_length=1, max_length=500)
    probability: float = Field(default=0.25, ge=0, le=1)
    min_factor: float = Field(default=1.5, ge=1, le=10)
    max_factor: float = Field(default=2.5, ge=1, le=10)
    seed: Optional[int] = None

    @model_validator(mode="after")
    def _range(self):
        if self.max_factor < self.min_factor:
            raise ValueError("max_factor must be >= min_factor")
        return self
