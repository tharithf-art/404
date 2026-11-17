-- EcoRoute database schema (SQLite)
-- Created automatically by backend/app/db.py on first start.
-- Data file: backend/data/ecoroute.db  (not committed to Git)

PRAGMA foreign_keys = ON;

-- Collection points with estimated waste
CREATE TABLE IF NOT EXISTS locations (
    id          TEXT PRIMARY KEY,                       -- e.g. LOC-001
    name        TEXT NOT NULL,
    area        TEXT DEFAULT '',
    lat         REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng         REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
    waste_kg    REAL NOT NULL CHECK (waste_kg >= 0),
    priority    TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
    overflow    INTEGER NOT NULL DEFAULT 0 CHECK (overflow IN (0, 1)),
    note        TEXT DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Collection vehicles and their capacity constraints
CREATE TABLE IF NOT EXISTS vehicles (
    id          TEXT PRIMARY KEY,                       -- e.g. V001
    label       TEXT DEFAULT '',
    type        TEXT DEFAULT '',
    capacity_kg REAL NOT NULL CHECK (capacity_kg > 0),
    available   INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    color       TEXT DEFAULT '#16a34a',                 -- route colour on the map
    color_name  TEXT DEFAULT 'Green',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- History of every optimisation run (summary + full JSON result)
CREATE TABLE IF NOT EXISTS optimisation_runs (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    n_locations           INTEGER NOT NULL,
    n_vehicles            INTEGER NOT NULL,
    total_waste_kg        REAL NOT NULL,
    collected_kg          REAL NOT NULL,
    optimised_distance_km REAL NOT NULL,
    baseline_distance_km  REAL NOT NULL,
    unserviced_count      INTEGER NOT NULL,
    fleet_utilisation_pct REAL NOT NULL,
    computation_time_ms   REAL,
    result_json           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_created ON optimisation_runs (created_at);
