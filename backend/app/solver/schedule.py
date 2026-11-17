"""
schedule.py — turns ordered routes into a timed collection schedule.

Travel time   = leg distance / average speed
Service time  = base minutes + minutes per 100 kg collected
All parameters come from SettingsIn and are assumptions (see README).
"""
from __future__ import annotations

from typing import List


def _fmt(minutes: float) -> str:
    m = int(round(minutes)) % (24 * 60)
    return f"{m // 60:02d}:{m % 60:02d}"


def parse_hhmm(s: str) -> float:
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def build_schedule(route: List[int], D, demand, start_min: float, speed_kmh: float,
                   svc_base: float, svc_per_100: float):
    """Return (stops, end_min, total_km). stops[i] relates to route[i]."""
    t = start_min
    km = 0.0
    load = 0.0
    prev = 0
    stops = []
    for seq, c in enumerate(route, start=1):
        leg = D[prev][c]
        km += leg
        t += leg / speed_kmh * 60.0
        arrive = t
        svc = svc_base + svc_per_100 * demand[c] / 100.0
        t += svc
        load += demand[c]
        stops.append({
            "seq": seq,
            "node": c,
            "leg_km": round(leg, 2),
            "cumulative_km": round(km, 2),
            "arrival": _fmt(arrive),
            "departure": _fmt(t),
            "arrival_min": round(arrive - start_min, 1),
            "service_min": round(svc, 1),
            "load_after_kg": round(load, 1),
        })
        prev = c
    if route:
        leg = D[prev][0]
        km += leg
        t += leg / speed_kmh * 60.0
    return stops, t, km


fmt_hhmm = _fmt
