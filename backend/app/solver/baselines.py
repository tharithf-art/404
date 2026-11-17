"""
baselines.py — simple reference strategies used for comparison.

1. sequential_baseline  — the "static schedule" a crew might follow without
   optimisation: visit locations in the order they are listed, filling one
   truck at a time; when the next location does not fit, that truck returns
   and the next truck continues the list (next-fit). Locations left when all
   trucks are full are unserviced.

2. nearest_neighbour    — greedy heuristic: largest truck first, always drive
   to the nearest unvisited location that still fits.
"""
from __future__ import annotations

from .problem import Problem, Solution


def sequential_baseline(p: Problem) -> Solution:
    routes = [[] for _ in p.caps]
    unserved = set()
    k = 0
    load = 0.0
    for c in range(1, p.n + 1):
        if p.demand[c] <= 0:
            continue
        while k < len(p.caps) and load + p.demand[c] > p.caps[k]:
            k += 1          # truck k is "full" -> next truck
            load = 0.0
        if k >= len(p.caps):
            unserved.add(c)
            continue
        routes[k].append(c)
        load += p.demand[c]
    return Solution(routes, unserved)


def nearest_neighbour(p: Problem) -> Solution:
    routes = [[] for _ in p.caps]
    remaining = {c for c in range(1, p.n + 1) if p.demand[c] > 0}
    order = sorted(range(len(p.caps)), key=lambda k: -p.caps[k])
    for k in order:
        cur, load = 0, 0.0
        while True:
            best, best_d = None, float("inf")
            for c in remaining:
                if load + p.demand[c] <= p.caps[k] and p.D[cur][c] < best_d:
                    best, best_d = c, p.D[cur][c]
            if best is None:
                break
            routes[k].append(best)
            remaining.discard(best)
            load += p.demand[best]
            cur = best
    return Solution(routes, remaining)
