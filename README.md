# EcoRoute – Adaptive Waste Collection and Resource Optimisation

**BuildX 0.1 · Challenge 05 – Adaptive Waste Collection and Resource Optimisation**

| | |
|---|---|
| **Project name** | EcoRoute |
| **Team identifier** | `TEAM-ID-HERE` ← *replace with your registered team ID* |
| **Challenge** | 05 – Vehicle routing and resource optimisation |

---

## 1. Problem being addressed

Local authorities often collect waste using a fixed, static schedule: the same trucks visit the same streets in the same order every day. When waste quantities change, for example bins overflowing after a festival or market day, that schedule:

- makes unnecessary travel, because the route order ignores geography,
- overloads some trucks while others run half-empty,
- has no rule for deciding which locations to skip when there is more waste than capacity. Urgent or overflowing points can be missed.

## 2. Proposed solution

EcoRoute is a web application. You enter collection points with estimated waste, define the fleet and its capacity limits, and it generates feasible routes and timed collection schedules using a Capacitated Vehicle Routing Problem (CVRP) optimiser. It:

- assigns locations to vehicles without exceeding any truck's capacity (hard constraint);
- orders each route to minimise travel (depot → stops → depot);
- produces a collection schedule per vehicle, with an ETA, the load after each stop and the leg distance;
- shows which locations cannot be serviced with the available capacity, with the reason and a recommendation;
- reports estimated distances and vehicle utilisation;
- compares the plan against a simple baseline and two other strategies on the same scenario;
- recalculates routes dynamically when waste levels change, a bin overflows, a truck breaks down or settings change;
- uses priority-based collection: High-priority and overflowing points are served first when capacity is short.

## 3. Main computational approach

The problem is a heterogeneous-fleet CVRP with optional customers (a prize-collecting variant). The solver is in `backend/app/solver/`.

**Objective (minimised):**

```
total route distance (km)
+ Σ unserved-location penalty   (priority-weighted kg; High 30, Medium 20, Low 10 per kg)
+ λ · Σ km travelled before reaching each High-priority stop   (λ = 0.05)
```

The penalty term is far larger than any distance term, so collecting waste always matters more than saving kilometres. Capacity can never be exceeded.

| Stage | Technique | File |
|---|---|---|
| Construction #1 | **Priority-tiered regret-2 insertion.** High/overflow stops are inserted first, then Medium, then Low. Within each tier, the stop with the largest regret (gap between its best and second-best insertion) is inserted first. | `cvrp.py` |
| Construction #2–4 | **Sweep clustering.** Stops are sorted by polar angle around the depot and cut into one sector per truck, starting from three different angles. | `cvrp.py` |
| Improvement | **Local search:** 2-opt, relocate, swap, insert-unserved, exchange-unserved, truck-swap. Every move checks capacity. | `cvrp.py` |
| Metaheuristic | **Iterated Local Search** with random and related (Shaw) removal, noisy regret repair and record-to-record acceptance. A seeded RNG makes results reproducible. | `cvrp.py` |
| Baseline | **Sequential next-fit:** locations visited in list order, one truck at a time (the "static schedule"). | `baselines.py` |
| Reference | **Greedy nearest-neighbour**, largest truck first. | `baselines.py` |
| Schedule | Travel time = distance / speed; service = 3 min + 2 min per 100 kg. | `schedule.py` |

**Why this design?** Exact CVRP solvers do not scale and are hard to explain in a live demo. Regret insertion handles tight capacity well, because it places hard-to-fit stops early. Local search plus ILS is a standard, well-understood approach that reaches near-optimal routes for 20–200 stops in about a second.

## 4. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 3, React Router, Recharts, Leaflet + React-Leaflet, Axios, Lucide icons |
| Backend | Python 3.10+, FastAPI, Pydantic v2 (validation), Uvicorn |
| Algorithms | Pure Python (no external solver), written by the team |
| Maps | OpenStreetMap tiles via Leaflet |
| Testing | pytest + FastAPI TestClient; benchmark script |

## 5. Architecture overview

```
┌──────────────────────────── React frontend (Vite) ────────────────────────────┐
│ Dashboard │ Locations (CRUD, inline waste) │ Vehicles (CRUD, breakdown toggle)│
│ Routes & Schedules │ Interactive Map (optimised/baseline) │ Strategy Comparison│
│        AppContext: scenario state + dynamic recalculation (debounced)        │
│        services/api.js  ── HTTP/JSON ──┐                                     │
└────────────────────────────────────────┼─────────────────────────────────────┘
                                         ▼
┌──────────────────────────── FastAPI backend ─────────────────────────────────┐
│ main.py      POST /api/optimize · POST /api/simulate/overflow · GET /health  │
│ models.py    Pydantic schemas + input validation                              │
│ service.py   build problem → run strategies → schedules → response           │
│ geo.py       haversine × road factor distance matrix                          │
│ solver/      problem.py · baselines.py · cvrp.py · schedule.py               │
└──────────────────────────────────────────────────────────────────────────────┘
```

The frontend contains no optimisation logic. All computation happens in the backend, so the solver can be tested on its own.

## 6. Installation

Prerequisites: **Python ≥ 3.10**, **Node.js ≥ 18**, **npm ≥ 9**.

```bash
# Backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
copy .env.example .env      # Windows   (macOS/Linux: cp .env.example .env)
```

## 7. Execution

Open two terminals:

```bash
# Terminal 1 – backend (API docs at http://localhost:8000/docs)
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 – frontend (http://localhost:5173)
cd frontend
npm run dev
```

**Tests and validation**

```bash
cd backend
python -m pytest                       # 23 tests: capacity, feasibility, priorities, validation, API
python -m scripts.benchmark --runs 20  # strategies compared over 20 random scenarios
```

**Demo script (about 5 minutes)**

1. **Routes & Schedules → Generate Optimised Routes.** 20 locations and 3 trucks (1,000 / 1,500 / 3,000 kg). Show the per-vehicle schedule and the capacity bars.
2. **Interactive Map.** Show the routes from the depot and switch between *Optimised* and *Baseline*.
3. **Strategy Comparison.** Compare baseline, greedy, distance-only and EcoRoute.
4. **Simulate overflow.** Waste rises above fleet capacity, routes recalculate automatically, and unserviced locations appear with reasons. No High-priority stops are missed.
5. **Vehicle Management → power icon on V003** to simulate a breakdown. The plan recalculates and the capacity shortfall is reported.
6. **Collection Locations.** Edit a waste value inline. The routes update.

## 8. Dataset and API information

- **Sample scenario:** `backend/data/sample_scenario.json` (the same data is in `frontend/src/data/mockData.js`).
  - **This is simulated data.** The road and place names are real streets in Colombo 07/08/10. GPS positions are estimates, not surveyed. Waste quantities are simulated (20 locations, 4,800 kg in total).
  - Vehicle capacities (1,000 / 1,500 / 3,000 kg) and the depot location are project assumptions, not CMC specifications.
- **Overflow events** are generated randomly (seedable) by `/api/simulate/overflow`: about 25 % of bins get ×1.5–2.5 waste.
- **Planning assumptions** can be edited in the UI: road factor 1.3, average speed 20 km/h, service time, shift start 06:00, 8-hour shift.
- **External services:** OpenStreetMap tiles (display only). The optimiser needs no external API.
- **Libraries:** FastAPI, Pydantic, Uvicorn, React, Vite, Tailwind CSS, Leaflet, React-Leaflet, Recharts, Axios and Lucide are acknowledged under their respective open-source licences. Map data © OpenStreetMap contributors.

### API

`POST /api/optimize`

```jsonc
{
  "locations": [{ "id": "LOC-001", "name": "...", "lat": 6.922, "lng": 79.8617,
                  "waste_kg": 240, "priority": "High", "overflow": false }],
  "vehicles":  [{ "id": "V001", "capacity_kg": 1000, "available": true }],
  "depot":     { "name": "Depot", "lat": 6.9167, "lng": 79.8636 },          // optional
  "settings":  { "shift_start": "06:00", "avg_speed_kmh": 20, "priority_aware": true,
                 "road_factor": 1.3, "time_budget_ms": 1500, "seed": 42 }     // optional
}
```

The response contains `routes[]`, each with `stops`, `schedule[]` (arrival, departure, load, leg km), `total_distance_km`, `capacity_pct` and `geometry`. It also contains `unserviced`, `unserviced_details[]` (reason and recommendation), `baseline`, `baseline_distance_km`, `optimised_distance_km`, `utilisation`, `strategies[]`, `warnings`, `solver` and `assumptions`. Invalid input (duplicate IDs, negative capacity, bad coordinates, no available vehicle, bad time format) returns **HTTP 422** with field-level messages.

## 9. Testing and validation results

These are the results of `python -m scripts.benchmark --runs 15` on simulated random scenarios with 20 locations and 3 trucks:

| Waste load | Strategy | Avg distance | Avg collected | High-priority missed |
|---|---|---|---|---|
| 85 % of capacity | Baseline (sequential) | 49.2 km | 4,675 kg | 0 |
| | Greedy nearest-neighbour | 26.1 km | 4,675 kg | 0 |
| | **EcoRoute** | **20.2 km** | 4,675 kg | 0 |
| 115 % of capacity | Baseline (sequential) | 40.9 km | 4,972 kg | 1.33 |
| | Greedy nearest-neighbour | 21.1 km | 5,194 kg | 0.80 |
| | CVRP distance-only | 27.3 km | 5,497 kg | 1.00 |
| | **EcoRoute (priority-aware)** | 24.5 km | 5,471 kg | **0.00** |

All strategies were capacity-feasible in every run. With enough capacity, EcoRoute cuts distance by about 59 % compared with the baseline. When capacity is short, it collects about 10 % more waste and never missed a High-priority location. *These figures come from simulated data, not real-world measurements.*

## 10. Known limitations

- **Distances are estimates:** straight-line distance × 1.3, not road-network routing. One-way streets and traffic are ignored. Map lines are drawn straight between stops.
- **One trip per vehicle per shift.** Return trips to a landfill or transfer station (e.g. Karadiyana) are not modelled.
- Shift length is reported as a warning, not enforced as a hard constraint. There are no customer time windows.
- Results are heuristic (near-optimal), not proven optimal. Quality depends on the time budget (1.5 s by default).
- Data is simulated. Real use would need surveyed coordinates, measured fill levels (e.g. bin sensors) and verified fleet specifications.
- No authentication or persistence. The scenario is held in browser memory and resets on reload.

**Future work:** OSRM road distances, multi-trip with disposal sites, time windows, waste forecasting from historical fill data, multi-day scheduling.

## Project structure

```
backend/
  app/
    main.py            FastAPI routes
    models.py          request/response validation
    service.py         orchestration, schedules, unserviced reasons
    geo.py             distance matrix
    solver/
      problem.py       CVRP model + objective
      baselines.py     sequential baseline, nearest neighbour
      cvrp.py          regret insertion, sweep, local search, ILS
      schedule.py      timetable builder
  data/sample_scenario.json
  scripts/benchmark.py
  tests/test_solver.py
  requirements.txt
frontend/
  src/ pages/, components/, context/AppContext.jsx, services/api.js, data/mockData.js
  package.json, vite.config.js, tailwind.config.js, .env.example
```
