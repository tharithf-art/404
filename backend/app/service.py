"""
service.py — orchestration: request -> problem -> strategies -> response.
"""
from __future__ import annotations

import random
import time
from typing import Dict, List

from .geo import distance_matrix
from .models import LocationIn, OptimizeRequest, OverflowRequest
from .solver.baselines import nearest_neighbour, sequential_baseline
from .solver.cvrp import optimise
from .solver.problem import Problem, Solution
from .solver.schedule import build_schedule, fmt_hhmm, parse_hhmm

STRATEGY_INFO = {
    "baseline": ("Baseline (sequential list order)",
                 "Visit locations in list order, filling one truck at a time (next-fit). "
                 "Represents a static, un-optimised schedule."),
    "greedy": ("Greedy nearest-neighbour",
               "Largest truck first; always drive to the closest location that still fits."),
    "distance_only": ("CVRP – distance only",
                      "Regret insertion + local search + ILS, ignoring priorities."),
    "optimised": ("CVRP – priority-aware (EcoRoute)",
                  "Priority-tiered regret insertion + local search (2-opt, relocate, swap, "
                  "exchange) + Iterated Local Search. High/overflow stops served first."),
}


def _effective_priority(l: LocationIn) -> str:
    return "High" if l.overflow else l.priority


def _render_solution(sol: Solution, p: Problem, locs: List[LocationIn], depot, vehicles, s) -> Dict:
    start = parse_hhmm(s.shift_start)
    routes = []
    warnings = []
    for k, r in enumerate(sol.routes):
        stops, end, km = build_schedule(r, p.D, p.demand, start, s.avg_speed_kmh,
                                        s.service_min_base, s.service_min_per_100kg)
        sched = []
        for st in stops:
            loc = locs[st.pop("node") - 1]
            sched.append({
                **st,
                "location_id": loc.id,
                "name": loc.name,
                "priority": loc.priority,
                "effective_priority": _effective_priority(loc),
                "overflow": loc.overflow,
                "waste_kg": loc.waste_kg,
                "lat": loc.lat,
                "lng": loc.lng,
            })
        load = p.load(r)
        cap = p.caps[k]
        duration = (end - start) if r else 0.0
        exceeds = duration > s.max_shift_min
        if exceeds:
            warnings.append(f"{vehicles[k].id} route takes {duration:.0f} min, "
                            f"longer than the {s.max_shift_min:.0f}-min shift.")
        geometry = []
        if r:
            geometry = [[depot.lat, depot.lng]] + [[locs[c - 1].lat, locs[c - 1].lng] for c in r] + \
                       [[depot.lat, depot.lng]]
        routes.append({
            "vehicle_id": vehicles[k].id,
            "capacity_kg": cap,
            "stops": [locs[c - 1].id for c in r],
            "schedule": sched,
            "geometry": geometry,
            "total_distance_km": round(km, 2),
            "return_leg_km": round(p.D[r[-1]][0], 2) if r else 0.0,
            "total_waste_kg": round(load, 1),
            "spare_capacity_kg": round(cap - load, 1),
            "capacity_pct": round(100 * load / cap, 1) if cap else 0.0,
            "start_time": s.shift_start if r else None,
            "end_time": fmt_hhmm(end) if r else None,
            "duration_min": round(duration, 1),
            "exceeds_shift": exceeds,
        })
    return {"routes": routes, "warnings": warnings}


def _summary(key: str, sol: Solution, rendered: Dict, p: Problem, total_cap: float) -> Dict:
    served = [c for r in sol.routes for c in r]
    served_kg = sum(p.demand[c] for c in served)
    uns_kg = sum(p.demand[c] for c in sol.unserved)
    dist = sol.distance(p)
    high_arrivals = [st["arrival_min"] for r in rendered["routes"] for st in r["schedule"]
                     if st["effective_priority"] == "High"]
    used = [r for r in rendered["routes"] if r["stops"]]
    name, desc = STRATEGY_INFO[key]
    return {
        "key": key,
        "name": name,
        "description": desc,
        "total_distance_km": round(dist, 2),
        "serviced_count": len(served),
        "serviced_kg": round(served_kg, 1),
        "unserviced_count": len(sol.unserved),
        "unserviced_kg": round(uns_kg, 1),
        "high_unserviced": sum(1 for c in sol.unserved if p.priority[c] == "High"),
        "vehicles_used": len(used),
        "fleet_utilisation_pct": round(100 * served_kg / total_cap, 1) if total_cap else 0.0,
        "km_per_tonne": round(dist / (served_kg / 1000), 2) if served_kg else None,
        "avg_high_arrival_min": round(sum(high_arrivals) / len(high_arrivals), 1) if high_arrivals else None,
        "max_route_duration_min": max((r["duration_min"] for r in used), default=0.0),
        "feasible": sol.is_feasible(p),
    }


def run_optimisation(req: OptimizeRequest) -> Dict:
    t0 = time.perf_counter()
    s = req.settings
    depot = req.depot

    active = [l for l in req.locations if l.waste_kg > 0]
    zero = [l.id for l in req.locations if l.waste_kg <= 0]
    vehicles = [v for v in req.vehicles if v.available]
    unavailable = [v.id for v in req.vehicles if not v.available]
    caps = [v.capacity_kg for v in vehicles]
    max_cap = max(caps)
    total_cap = sum(caps)

    too_big = [l for l in active if l.waste_kg > max_cap]
    locs = [l for l in active if l.waste_kg <= max_cap]

    unserviced_details = [{
        "id": l.id, "name": l.name, "waste_kg": l.waste_kg, "priority": l.priority,
        "overflow": l.overflow,
        "reason": f"Waste ({l.waste_kg:g} kg) exceeds the largest available vehicle ({max_cap:g} kg).",
        "recommendation": "Split collection across trips or dispatch a larger vehicle.",
    } for l in too_big]

    pts = [(depot.lat, depot.lng)] + [(l.lat, l.lng) for l in locs]

    def make_problem(priority_aware: bool) -> Problem:
        return Problem(
            D=distance_matrix(pts, s.road_factor),
            demand=[0.0] + [l.waste_kg for l in locs],
            priority=[""] + [_effective_priority(l) for l in locs],
            caps=caps,
            vehicle_ids=[v.id for v in vehicles],
            priority_aware=priority_aware,
        )

    strategies, rendered_by_key, solver_meta = [], {}, {}
    if locs:
        p = make_problem(s.priority_aware)
        p_flat = make_problem(False)

        base = sequential_baseline(p)
        greedy = nearest_neighbour(p)
        main = optimise(p, time_budget_ms=s.time_budget_ms, seed=s.seed, coords=pts)
        sols = [("baseline", base, p), ("greedy", greedy, p)]
        if s.priority_aware:
            flat = optimise(p_flat, time_budget_ms=s.time_budget_ms, seed=s.seed, coords=pts)
            sols.append(("distance_only", flat["solution"], p_flat))
        sols.append(("optimised", main["solution"], p))
        solver_meta = {k: main[k] for k in ("iterations", "improvements", "elapsed_ms", "restarts")}

        for key, sol, prob in sols:
            rendered = _render_solution(sol, prob, locs, depot, vehicles, s)
            rendered_by_key[key] = (sol, rendered)
            strategies.append(_summary(key, sol, rendered, prob, total_cap))
        best_sol, best = rendered_by_key["optimised"]
        base_sol, base_r = rendered_by_key["baseline"]
    else:
        best_sol = base_sol = Solution([[] for _ in caps], set())
        best = base_r = {"routes": [], "warnings": []}

    total_waste = sum(l.waste_kg for l in active)
    shortfall = total_waste - total_cap
    for c in sorted(best_sol.unserved, key=lambda c: locs[c - 1].id):
        l = locs[c - 1]
        if shortfall > 0:
            reason = (f"Fleet capacity exhausted: total waste {total_waste:g} kg exceeds available "
                      f"capacity {total_cap:g} kg. Lower-priority / lower-value stops are deferred.")
        else:
            reason = ("Remaining space on each truck is smaller than this location's load "
                      "(capacity is fragmented across vehicles).")
        unserviced_details.append({
            "id": l.id, "name": l.name, "waste_kg": l.waste_kg, "priority": l.priority,
            "overflow": l.overflow, "reason": reason,
            "recommendation": "Carry over as a first stop in the next shift or add a second trip.",
        })

    served_kg = sum(r["total_waste_kg"] for r in best["routes"])
    opt_km = round(sum(r["total_distance_km"] for r in best["routes"]), 2)
    base_km = round(sum(r["total_distance_km"] for r in base_r["routes"]), 2)

    for r in best["routes"]:
        if r["capacity_pct"] > 100.0001:   # defensive: should never happen
            raise RuntimeError(f"Capacity violated on {r['vehicle_id']}")

    return {
        "status": "success",
        "depot": {"name": depot.name, "lat": depot.lat, "lng": depot.lng},
        "routes": best["routes"],
        "unserviced": [u["id"] for u in unserviced_details],
        "unserviced_details": unserviced_details,
        "skipped_zero_waste": zero,
        "unavailable_vehicles": unavailable,
        "baseline": {
            "routes": base_r["routes"],
            "unserviced": [locs[c - 1].id for c in sorted(base_sol.unserved)] + [l.id for l in too_big],
        },
        "baseline_distance_km": base_km,
        "optimised_distance_km": opt_km,
        "distance_saved_pct": round(100 * (base_km - opt_km) / base_km, 1) if base_km else 0.0,
        "utilisation": {
            "fleet_capacity_kg": total_cap,
            "total_waste_kg": round(total_waste, 1),
            "collected_kg": round(served_kg, 1),
            "fleet_utilisation_pct": round(100 * served_kg / total_cap, 1) if total_cap else 0.0,
            "collection_rate_pct": round(100 * served_kg / total_waste, 1) if total_waste else 100.0,
        },
        "strategies": strategies,
        "warnings": best["warnings"],
        "solver": {
            "algorithm": "Multi-start (regret-2 insertion + sweep clustering) → local search → Iterated Local Search",
            "seed": s.seed,
            "time_budget_ms": s.time_budget_ms,
            **solver_meta,
        },
        "assumptions": {
            "distance_model": f"Haversine × road factor {s.road_factor}",
            "avg_speed_kmh": s.avg_speed_kmh,
            "service_time": f"{s.service_min_base} min + {s.service_min_per_100kg} min per 100 kg",
            "shift_start": s.shift_start,
            "max_shift_min": s.max_shift_min,
            "depot": depot.name,
            "single_trip_per_vehicle": True,
        },
        "computation_time_ms": round((time.perf_counter() - t0) * 1000, 1),
    }


def simulate_overflow(req: OverflowRequest) -> Dict:
    """Randomly mark some bins as overflowing and inflate their waste (simulated)."""
    rng = random.Random(req.seed)
    out, changed = [], []
    for l in req.locations:
        d = l.model_dump()
        if rng.random() < req.probability:
            factor = rng.uniform(req.min_factor, req.max_factor)
            d["waste_kg"] = round(l.waste_kg * factor)
            d["overflow"] = True
            changed.append({"id": l.id, "from_kg": l.waste_kg, "to_kg": d["waste_kg"],
                            "factor": round(factor, 2)})
        out.append(d)
    return {"locations": out, "changed": changed, "simulated": True}
