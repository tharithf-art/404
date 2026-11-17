"""
cvrp.py — the main optimiser.

Pipeline
  1. Priority-tiered regret-2 insertion (construction)
       High/overflow locations are inserted first, then Medium, then Low,
       so scarce capacity goes to urgent locations. Within a tier the
       location whose best and second-best insertions differ most ("regret")
       is inserted first — it has the most to lose by waiting.
  2. Local search (first-improvement, repeated until no move improves)
       • 2-opt            reverse a segment inside one route
       • relocate         move one stop to another position / truck
       • swap             exchange two stops between trucks
       • insert-unserved  add a skipped location if capacity was freed
       • exchange-unserved  replace a served stop with a more valuable one
       • truck-swap       give a whole route to a different-capacity truck
  3. Iterated Local Search (ILS)
       Repeatedly destroy part of the best-known solution (random or
       geographically related removal), rebuild with regret insertion and
       re-run local search. Keeps the best result. Seeded RNG → reproducible.

Capacity is a hard constraint everywhere: no move may overload a truck.
"""
from __future__ import annotations

import random
import time
from typing import List, Optional, Set

from .problem import Problem, Solution

TIERS = ("High", "Medium", "Low")
INF = float("inf")


# ── construction ────────────────────────────────────────────────────────────
def _best_insertions(p: Problem, routes, loads, c):
    """Return list of (delta_distance, k, pos) feasible insertions for c, sorted."""
    D = p.D
    out = []
    dem = p.demand[c]
    for k, r in enumerate(routes):
        if loads[k] + dem > p.caps[k] + 1e-9:
            continue
        prev = 0
        for pos in range(len(r) + 1):
            nxt = r[pos] if pos < len(r) else 0
            delta = D[prev][c] + D[c][nxt] - D[prev][nxt]
            out.append((delta, k, pos))
            prev = nxt
    out.sort()
    return out


def regret_insert(p: Problem, sol: Solution, pending: Set[int], rng: Optional[random.Random] = None) -> None:
    """Insert `pending` customers into sol (in place). Those that cannot fit go to sol.unserved.
    With `rng`, regret scores get +-20% noise to diversify ILS rebuilds."""
    loads = [p.load(r) for r in sol.routes]
    tiers = TIERS if p.priority_aware else (None,)
    for tier in tiers:
        group = {c for c in pending if tier is None or p.priority[c] == tier}
        while group:
            pick, pick_ins, pick_score = None, None, -INF
            for c in group:
                ins = _best_insertions(p, sol.routes, loads, c)
                if not ins:
                    score = INF  # cannot be inserted — resolve immediately
                else:
                    second = ins[1][0] if len(ins) > 1 else ins[0][0] + 1e3
                    score = (second - ins[0][0]) + 1e-6 * p.demand[c]
                    if rng is not None:
                        score *= rng.uniform(0.8, 1.2)
                if score > pick_score or (score == pick_score and c < pick):
                    pick, pick_ins, pick_score = c, ins, score
            group.discard(pick)
            pending.discard(pick)
            if not pick_ins:
                sol.unserved.add(pick)
                continue
            _, k, pos = pick_ins[0]
            sol.routes[k].insert(pos, pick)
            loads[k] += p.demand[pick]
            sol.unserved.discard(pick)


def construct(p: Problem) -> Solution:
    sol = Solution([[] for _ in p.caps], set())
    regret_insert(p, sol, set(range(1, p.n + 1)))
    return sol


# ── local search ────────────────────────────────────────────────────────────
class _Deadline:
    def __init__(self, t_end: float):
        self.t_end = t_end

    def hit(self) -> bool:
        return time.perf_counter() > self.t_end


def _two_opt(p: Problem, r: List[int], dl: _Deadline) -> bool:
    improved = False
    best = p.route_cost(r)
    n = len(r)
    i = 0
    while i < n - 1:
        for j in range(i + 1, n):
            cand = r[:i] + r[i:j + 1][::-1] + r[j + 1:]
            c = p.route_cost(cand)
            if c < best - 1e-9:
                r[:] = cand
                best = c
                improved = True
        i += 1
        if dl.hit():
            break
    return improved


def _relocate(p: Problem, sol: Solution, loads, costs, dl: _Deadline) -> bool:
    R = sol.routes
    for a in range(len(R)):
        for i in range(len(R[a])):
            c = R[a][i]
            ra_new = R[a][:i] + R[a][i + 1:]
            ca_new = p.route_cost(ra_new)
            for b in range(len(R)):
                if b != a and loads[b] + p.demand[c] > p.caps[b] + 1e-9:
                    continue
                base_b = ra_new if b == a else R[b]
                for pos in range(len(base_b) + 1):
                    rb_new = base_b[:pos] + [c] + base_b[pos:]
                    if b == a:
                        delta = p.route_cost(rb_new) - costs[a]
                    else:
                        delta = ca_new + p.route_cost(rb_new) - costs[a] - costs[b]
                    if delta < -1e-9:
                        if b == a:
                            R[a] = rb_new
                        else:
                            R[a], R[b] = ra_new, rb_new
                            loads[a] -= p.demand[c]
                            loads[b] += p.demand[c]
                            costs[b] = p.route_cost(R[b])
                        costs[a] = p.route_cost(R[a])
                        return True
            if dl.hit():
                return False
    return False


def _swap(p: Problem, sol: Solution, loads, costs, dl: _Deadline) -> bool:
    R = sol.routes
    for a in range(len(R)):
        for b in range(a + 1, len(R)):
            for i in range(len(R[a])):
                for j in range(len(R[b])):
                    ci, cj = R[a][i], R[b][j]
                    la = loads[a] - p.demand[ci] + p.demand[cj]
                    lb = loads[b] - p.demand[cj] + p.demand[ci]
                    if la > p.caps[a] + 1e-9 or lb > p.caps[b] + 1e-9:
                        continue
                    ra = R[a][:i] + [cj] + R[a][i + 1:]
                    rb = R[b][:j] + [ci] + R[b][j + 1:]
                    ca, cb = p.route_cost(ra), p.route_cost(rb)
                    if ca + cb < costs[a] + costs[b] - 1e-9:
                        R[a], R[b] = ra, rb
                        loads[a], loads[b] = la, lb
                        costs[a], costs[b] = ca, cb
                        return True
            if dl.hit():
                return False
    return False


def _insert_unserved(p: Problem, sol: Solution, loads, costs) -> bool:
    for u in sorted(sol.unserved, key=lambda x: -p.penalty[x]):
        best = None
        for k, r in enumerate(sol.routes):
            if loads[k] + p.demand[u] > p.caps[k] + 1e-9:
                continue
            for pos in range(len(r) + 1):
                cand = r[:pos] + [u] + r[pos:]
                delta = p.route_cost(cand) - costs[k] - p.penalty[u]
                if delta < -1e-9 and (best is None or delta < best[0]):
                    best = (delta, k, cand)
        if best:
            _, k, cand = best
            sol.routes[k] = cand
            loads[k] += p.demand[u]
            costs[k] = p.route_cost(cand)
            sol.unserved.discard(u)
            return True
    return False


def _exchange_unserved(p: Problem, sol: Solution, loads, costs) -> bool:
    for u in sorted(sol.unserved, key=lambda x: -p.penalty[x]):
        for k, r in enumerate(sol.routes):
            for i, s in enumerate(r):
                if loads[k] - p.demand[s] + p.demand[u] > p.caps[k] + 1e-9:
                    continue
                cand = r[:i] + [u] + r[i + 1:]
                delta = p.route_cost(cand) - costs[k] + p.penalty[s] - p.penalty[u]
                if delta < -1e-9:
                    sol.routes[k] = cand
                    loads[k] += p.demand[u] - p.demand[s]
                    costs[k] = p.route_cost(cand)
                    sol.unserved.discard(u)
                    sol.unserved.add(s)
                    return True
    return False


def _truck_swap(p: Problem, sol: Solution, loads, costs) -> bool:
    """Swap whole routes between trucks if that lets an unserved stop fit."""
    if not sol.unserved:
        return False
    R = sol.routes
    for a in range(len(R)):
        for b in range(a + 1, len(R)):
            if loads[a] <= p.caps[b] + 1e-9 and loads[b] <= p.caps[a] + 1e-9:
                trial = sol.copy()
                trial.routes[a], trial.routes[b] = trial.routes[b], trial.routes[a]
                tl = [p.load(r) for r in trial.routes]
                tc = [p.route_cost(r) for r in trial.routes]
                if _insert_unserved(p, trial, tl, tc):
                    sol.routes, sol.unserved = trial.routes, trial.unserved
                    loads[:] = tl
                    costs[:] = tc
                    return True
    return False


def local_search(p: Problem, sol: Solution, dl: _Deadline) -> Solution:
    loads = [p.load(r) for r in sol.routes]
    costs = [p.route_cost(r) for r in sol.routes]
    while not dl.hit():
        if _insert_unserved(p, sol, loads, costs):
            continue
        if _exchange_unserved(p, sol, loads, costs):
            continue
        if _truck_swap(p, sol, loads, costs):
            continue
        if _relocate(p, sol, loads, costs, dl):
            continue
        if _swap(p, sol, loads, costs, dl):
            continue
        any2 = False
        for k, r in enumerate(sol.routes):
            if _two_opt(p, r, dl):
                costs[k] = p.route_cost(r)
                any2 = True
        if not any2:
            break
    return sol


# ── iterated local search ───────────────────────────────────────────────────
def _destroy(p: Problem, sol: Solution, rng: random.Random) -> Set[int]:
    served = [c for r in sol.routes for c in r]
    if not served:
        return set()
    k = max(2, int(len(served) * rng.uniform(0.15, 0.35)))
    k = min(k, len(served))
    if rng.random() < 0.5:
        removed = set(rng.sample(served, k))                       # random removal
    else:
        seed = rng.choice(served)                                    # related (Shaw) removal
        removed = set(sorted(served, key=lambda c: p.D[seed][c])[:k])
    sol.routes = [[c for c in r if c not in removed] for r in sol.routes]
    return removed


def sweep_construct(p: Problem, coords, offset: float) -> Solution:
    """Sweep clustering: order stops by polar angle around the depot (starting at
    `offset` radians) and cut the circle into consecutive sectors, one per
    truck (largest truck first). Leftovers are handed to regret insertion."""
    import math
    dlat0, dlng0 = coords[0]
    ang = {}
    for c in range(1, p.n + 1):
        a = math.atan2(coords[c][0] - dlat0, coords[c][1] - dlng0)
        ang[c] = (a - offset) % (2 * math.pi)
    order = sorted(range(1, p.n + 1), key=lambda c: ang[c])
    trucks = sorted(range(len(p.caps)), key=lambda k: -p.caps[k])
    sol = Solution([[] for _ in p.caps], set())
    ti, load, left = 0, 0.0, set()
    for c in order:
        while ti < len(trucks) and load + p.demand[c] > p.caps[trucks[ti]]:
            ti, load = ti + 1, 0.0
        if ti >= len(trucks):
            left.add(c)
            continue
        sol.routes[trucks[ti]].append(c)
        load += p.demand[c]
    regret_insert(p, sol, left)
    return sol


def _ils(p: Problem, start: Solution, dl: "_Deadline", rng: random.Random, max_iterations: int):
    sol = local_search(p, start, dl)
    best, best_obj = sol.copy(), sol.objective(p)
    cur, cur_obj = best.copy(), best_obj
    iters = improvements = 0
    # Record-to-record acceptance: allow candidates up to `thr` worse than the
    # best (thr shrinks linearly to 0) so the search can leave local optima
    # created by tight capacity constraints.
    thr0 = 0.08 * max(best.distance(p), 1e-6)
    while iters < max_iterations and not dl.hit():
        iters += 1
        thr = thr0 * (1 - iters / max_iterations)
        cand = cur.copy()
        removed = _destroy(p, cand, rng)
        removed |= set(cand.unserved)
        cand.unserved.clear()
        regret_insert(p, cand, removed, rng)
        cand = local_search(p, cand, dl)
        obj = cand.objective(p)
        if obj < best_obj - 1e-9:
            best, best_obj = cand.copy(), obj
            improvements += 1
        if obj < best_obj + thr:
            cur, cur_obj = cand, obj
        else:
            cur, cur_obj = best.copy(), best_obj
    return best, best_obj, iters, improvements


def optimise(p: Problem, time_budget_ms: int = 1500, seed: int = 42,
             max_iterations: int = 1200, coords=None, restarts: int = 4) -> dict:
    """Multi-start ILS. Start 0 = regret construction; others = sweep clustering
    from evenly spaced angles (needs `coords`, list of (lat, lng) incl. depot)."""
    import math
    t0 = time.perf_counter()
    rng = random.Random(seed)
    starts = [("regret", construct(p))]
    if coords is not None:
        for i in range(1, restarts):
            starts.append((f"sweep{i}", sweep_construct(p, coords, 2 * math.pi * i / max(1, restarts - 1))))
    per_iter = max(1, max_iterations // len(starts))
    t_total = time_budget_ms / 1000.0

    best = best_obj = None
    iters = improvements = 0
    runs = []
    for i, (name, st) in enumerate(starts):
        remaining = t_total - (time.perf_counter() - t0)
        dl = _Deadline(time.perf_counter() + max(0.01, remaining / (len(starts) - i)))
        sol, obj, it, imp = _ils(p, st, dl, rng, per_iter)
        iters += it
        improvements += imp
        runs.append({"start": name, "objective": round(obj, 3), "distance_km": round(sol.distance(p), 3)})
        if best is None or obj < best_obj - 1e-9:
            best, best_obj = sol, obj

    return {
        "solution": best,
        "objective": best_obj,
        "iterations": iters,
        "improvements": improvements,
        "restarts": runs,
        "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
    }
