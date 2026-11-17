"""
benchmark.py — compare strategies over many random (simulated) scenarios.

Usage (from backend/):  python -m scripts.benchmark --runs 20
Prints average distance, waste collected and High-priority misses per strategy,
which is the evidence for "validated on different inputs, not one example".
"""
import argparse
import random
import statistics
from collections import defaultdict

from app.models import OptimizeRequest
from app.service import run_optimisation


def scenario(seed: int, n: int, load_factor: float):
    rng = random.Random(seed)
    vehicles = [{"id": "V001", "capacity_kg": 1000}, {"id": "V002", "capacity_kg": 1500},
                {"id": "V003", "capacity_kg": 3000}]
    target = sum(v["capacity_kg"] for v in vehicles) * load_factor
    raw = [rng.uniform(0.5, 1.5) for _ in range(n)]
    scale = target / sum(raw)
    locs = [{"id": f"S{i:03d}", "name": f"Sim {i}",
             "lat": 6.90 + rng.random() * 0.03, "lng": 79.855 + rng.random() * 0.03,
             "waste_kg": round(r * scale), "priority": rng.choice(["High", "Medium", "Low"])}
            for i, r in enumerate(raw)]
    return locs, vehicles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=20)
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--budget", type=int, default=800)
    args = ap.parse_args()

    for lf in (0.85, 1.15):
        agg = defaultdict(lambda: defaultdict(list))
        for s in range(args.runs):
            locs, veh = scenario(s, args.n, lf)
            res = run_optimisation(OptimizeRequest(locations=locs, vehicles=veh,
                                                   settings={"time_budget_ms": args.budget, "seed": s}))
            for st in res["strategies"]:
                a = agg[st["name"]]
                a["km"].append(st["total_distance_km"])
                a["kg"].append(st["serviced_kg"])
                a["high_missed"].append(st["high_unserviced"])
                a["feasible"].append(st["feasible"])
        print(f"\n=== {args.runs} random scenarios, {args.n} locations, waste = {lf:.0%} of fleet capacity ===")
        print(f"{'Strategy':38s} {'avg km':>8s} {'avg kg':>9s} {'High missed':>12s} {'feasible':>9s}")
        for name, a in agg.items():
            print(f"{name:38s} {statistics.mean(a['km']):8.2f} {statistics.mean(a['kg']):9.0f} "
                  f"{statistics.mean(a['high_missed']):12.2f} {all(a['feasible'])!s:>9s}")


if __name__ == "__main__":
    main()
