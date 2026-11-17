"""
db.py — SQLite persistence (Python standard library, no extra install).

The database file is created on first start and filled with the 20-location
sample scenario. Set the ECOROUTE_DB environment variable to use another file
(the tests do this so they never touch your real data).
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
SCHEMA_FILE = BACKEND_DIR / "db" / "schema.sql"
SAMPLE_FILE = BACKEND_DIR / "data" / "sample_scenario.json"

PALETTE = [("#16a34a", "Green"), ("#2563eb", "Blue"), ("#ea580c", "Orange"), ("#9333ea", "Purple"),
           ("#0891b2", "Teal"), ("#db2777", "Pink"), ("#854d0e", "Brown"), ("#4b5563", "Grey")]


def db_path() -> Path:
    return Path(os.getenv("ECOROUTE_DB", BACKEND_DIR / "data" / "ecoroute.db"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Create tables if needed and load the sample scenario into an empty database."""
    db_path().parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        empty = conn.execute("SELECT COUNT(*) FROM locations").fetchone()[0] == 0 and \
            conn.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0] == 0
        if empty:
            _seed(conn)


def reset_to_sample() -> None:
    """Delete all locations and vehicles and reload the sample scenario (run history is kept)."""
    with connect() as conn:
        conn.execute("DELETE FROM locations")
        conn.execute("DELETE FROM vehicles")
        _seed(conn)


def _seed(conn: sqlite3.Connection) -> None:
    data = json.loads(SAMPLE_FILE.read_text(encoding="utf-8"))
    for l in data["locations"]:
        conn.execute(
            "INSERT INTO locations (id, name, area, lat, lng, waste_kg, priority, overflow, note) "
            "VALUES (?,?,?,?,?,?,?,0,?)",
            (l["id"], l["name"], l["name"].split(" (")[0], l["lat"], l["lng"], l["waste_kg"], l["priority"],
             "Simulated coordinate – estimated position on named road"))
    for i, v in enumerate(data["vehicles"]):
        color, cname = PALETTE[i % len(PALETTE)]
        conn.execute(
            "INSERT INTO vehicles (id, label, type, capacity_kg, available, color, color_name) "
            "VALUES (?,?,?,?,1,?,?)",
            (v["id"], f"Vehicle {v['id'][1:]}", v.get("type", ""), v["capacity_kg"], color, cname))


# ── helpers ──────────────────────────────────────────────────────────────────
def _loc(row) -> Dict:
    d = dict(row)
    d["overflow"] = bool(d["overflow"])
    return d


def _veh(row) -> Dict:
    d = dict(row)
    d["available"] = bool(d["available"])
    d["colorName"] = d.pop("color_name")
    return d


def _next_id(conn, table: str, prefix: str, width: int) -> str:
    nums = [int(m.group(1)) for (i,) in conn.execute(f"SELECT id FROM {table}")
            if (m := re.fullmatch(rf"{prefix}(\d+)", i))]
    return f"{prefix}{(max(nums) + 1 if nums else 1):0{width}d}"


# ── locations ────────────────────────────────────────────────────────────────
def list_locations() -> List[Dict]:
    with connect() as conn:
        return [_loc(r) for r in conn.execute("SELECT * FROM locations ORDER BY id")]


def get_location(loc_id: str) -> Optional[Dict]:
    with connect() as conn:
        r = conn.execute("SELECT * FROM locations WHERE id = ?", (loc_id,)).fetchone()
        return _loc(r) if r else None


def create_location(data: Dict) -> Dict:
    with connect() as conn:
        loc_id = data.get("id") or _next_id(conn, "locations", "LOC-", 3)
        if conn.execute("SELECT 1 FROM locations WHERE id = ?", (loc_id,)).fetchone():
            raise ValueError(f"Location {loc_id} already exists")
        conn.execute(
            "INSERT INTO locations (id, name, area, lat, lng, waste_kg, priority, overflow, note) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (loc_id, data["name"], data.get("area") or "", data["lat"], data["lng"], data["waste_kg"],
             data.get("priority", "Medium"), int(bool(data.get("overflow"))), data.get("note") or ""))
    return get_location(loc_id)


def update_location(loc_id: str, data: Dict) -> Optional[Dict]:
    fields = {k: v for k, v in data.items()
              if k in {"name", "area", "lat", "lng", "waste_kg", "priority", "overflow", "note"} and v is not None}
    if "overflow" in fields:
        fields["overflow"] = int(bool(fields["overflow"]))
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields) + ", updated_at = datetime('now')"
        with connect() as conn:
            conn.execute(f"UPDATE locations SET {sets} WHERE id = ?", (*fields.values(), loc_id))
    return get_location(loc_id)


def delete_location(loc_id: str) -> bool:
    with connect() as conn:
        return conn.execute("DELETE FROM locations WHERE id = ?", (loc_id,)).rowcount > 0


# ── vehicles ─────────────────────────────────────────────────────────────────
def list_vehicles() -> List[Dict]:
    with connect() as conn:
        return [_veh(r) for r in conn.execute("SELECT * FROM vehicles ORDER BY id")]


def get_vehicle(veh_id: str) -> Optional[Dict]:
    with connect() as conn:
        r = conn.execute("SELECT * FROM vehicles WHERE id = ?", (veh_id,)).fetchone()
        return _veh(r) if r else None


def create_vehicle(data: Dict) -> Dict:
    with connect() as conn:
        veh_id = data.get("id") or _next_id(conn, "vehicles", "V", 3)
        if conn.execute("SELECT 1 FROM vehicles WHERE id = ?", (veh_id,)).fetchone():
            raise ValueError(f"Vehicle {veh_id} already exists")
        n = conn.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]
        color, cname = PALETTE[n % len(PALETTE)]
        conn.execute(
            "INSERT INTO vehicles (id, label, type, capacity_kg, available, color, color_name) "
            "VALUES (?,?,?,?,?,?,?)",
            (veh_id, data.get("label") or f"Vehicle {veh_id[1:]}", data.get("type") or "",
             data["capacity_kg"], int(data.get("available", True)), data.get("color") or color,
             data.get("colorName") or cname))
    return get_vehicle(veh_id)


def update_vehicle(veh_id: str, data: Dict) -> Optional[Dict]:
    mapping = {"label": "label", "type": "type", "capacity_kg": "capacity_kg", "available": "available",
               "color": "color", "colorName": "color_name"}
    fields = {mapping[k]: v for k, v in data.items() if k in mapping and v is not None}
    if "available" in fields:
        fields["available"] = int(bool(fields["available"]))
    if fields:
        sets = ", ".join(f"{k} = ?" for k in fields) + ", updated_at = datetime('now')"
        with connect() as conn:
            conn.execute(f"UPDATE vehicles SET {sets} WHERE id = ?", (*fields.values(), veh_id))
    return get_vehicle(veh_id)


def delete_vehicle(veh_id: str) -> bool:
    with connect() as conn:
        return conn.execute("DELETE FROM vehicles WHERE id = ?", (veh_id,)).rowcount > 0


# ── optimisation runs ────────────────────────────────────────────────────────
def save_run(result: Dict, n_locations: int, n_vehicles: int) -> int:
    u = result["utilisation"]
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO optimisation_runs (n_locations, n_vehicles, total_waste_kg, collected_kg, "
            "optimised_distance_km, baseline_distance_km, unserviced_count, fleet_utilisation_pct, "
            "computation_time_ms, result_json) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (n_locations, n_vehicles, u["total_waste_kg"], u["collected_kg"], result["optimised_distance_km"],
             result["baseline_distance_km"], len(result["unserviced"]), u["fleet_utilisation_pct"],
             result.get("computation_time_ms"), json.dumps(result)))
        return cur.lastrowid


def list_runs(limit: int = 50) -> List[Dict]:
    with connect() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT id, created_at, n_locations, n_vehicles, total_waste_kg, collected_kg, "
            "optimised_distance_km, baseline_distance_km, unserviced_count, fleet_utilisation_pct, "
            "computation_time_ms FROM optimisation_runs ORDER BY id DESC LIMIT ?", (limit,))]


def get_run(run_id: int) -> Optional[Dict]:
    with connect() as conn:
        r = conn.execute("SELECT * FROM optimisation_runs WHERE id = ?", (run_id,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d["result"] = json.loads(d.pop("result_json"))
    return d


def clear_runs() -> int:
    with connect() as conn:
        return conn.execute("DELETE FROM optimisation_runs").rowcount


def stats() -> Dict:
    with connect() as conn:
        c = lambda t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        return {"database_file": str(db_path()), "locations": c("locations"),
                "vehicles": c("vehicles"), "optimisation_runs": c("optimisation_runs")}
