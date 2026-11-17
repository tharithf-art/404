"""
problem.py — internal representation of a Capacitated VRP instance with a
heterogeneous fleet, optional (prize-collecting) customers and priorities.

Indexing: node 0 is the depot, nodes 1..n are collection locations.
A solution is a list of routes (one per available vehicle, same order as
Problem.caps) plus a set of unserved nodes.

Objective (lower is better):
    total route distance (km)
  + Σ unserved penalty           (priority-weighted kg, dominates distance)
  + λ · Σ arrival-km of High     (only when priority_aware; pulls urgent
                                  stops earlier in the route)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Set

# Penalty per kg left uncollected, in "km-equivalents".
# Large enough that collecting waste always beats saving distance.
PRIORITY_KG_WEIGHT = {"High": 30.0, "Medium": 20.0, "Low": 10.0}
FLAT_KG_WEIGHT = 20.0
PER_STOP_PENALTY = 50.0          # so even tiny loads are worth visiting
HIGH_LATENESS_WEIGHT = 0.05      # λ: km-equivalent per km travelled before a High stop


@dataclass
class Problem:
    D: List[List[float]]
    demand: List[float]
    priority: List[str]            # effective priority per node ('' for depot)
    caps: List[float]              # one entry per available vehicle
    vehicle_ids: List[str]
    priority_aware: bool = True
    penalty: List[float] = field(default_factory=list)

    def __post_init__(self):
        self.n = len(self.demand) - 1
        if not self.penalty:
            pen = [0.0]
            for i in range(1, self.n + 1):
                w = PRIORITY_KG_WEIGHT[self.priority[i]] if self.priority_aware else FLAT_KG_WEIGHT
                pen.append(PER_STOP_PENALTY + w * self.demand[i])
            self.penalty = pen
        self.is_high = [p == "High" for p in self.priority]

    # ── costs ────────────────────────────────────────────────────────────────
    def route_distance(self, r: List[int]) -> float:
        if not r:
            return 0.0
        D = self.D
        d = D[0][r[0]] + D[r[-1]][0]
        for a, b in zip(r, r[1:]):
            d += D[a][b]
        return d

    def route_cost(self, r: List[int]) -> float:
        if not r:
            return 0.0
        if not self.priority_aware:
            return self.route_distance(r)
        D = self.D
        cum = 0.0
        late = 0.0
        prev = 0
        for c in r:
            cum += D[prev][c]
            if self.is_high[c]:
                late += cum
            prev = c
        cum += D[prev][0]
        return cum + HIGH_LATENESS_WEIGHT * late

    def load(self, r: List[int]) -> float:
        return sum(self.demand[c] for c in r)


@dataclass
class Solution:
    routes: List[List[int]]
    unserved: Set[int]

    def copy(self) -> "Solution":
        return Solution([list(r) for r in self.routes], set(self.unserved))

    def objective(self, p: Problem) -> float:
        return sum(p.route_cost(r) for r in self.routes) + sum(p.penalty[u] for u in self.unserved)

    def distance(self, p: Problem) -> float:
        return sum(p.route_distance(r) for r in self.routes)

    def is_feasible(self, p: Problem) -> bool:
        seen = set()
        for k, r in enumerate(self.routes):
            if p.load(r) > p.caps[k] + 1e-9:
                return False
            for c in r:
                if c in seen:
                    return False
                seen.add(c)
        return seen.isdisjoint(self.unserved) and len(seen) + len(self.unserved) == p.n
