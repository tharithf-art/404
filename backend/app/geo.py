"""
geo.py — distance utilities.

Distances are great-circle (haversine) distances multiplied by a road
circuity factor. The factor (default 1.3) approximates the fact that real
streets are longer than straight lines. It is an ASSUMPTION, not a measured
value; the README lists it under known limitations.
"""
from __future__ import annotations

import math
from typing import List, Sequence, Tuple

EARTH_RADIUS_KM = 6371.0088


def haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lng) points in kilometres."""
    lat1, lng1 = map(math.radians, a)
    lat2, lng2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def distance_matrix(points: Sequence[Tuple[float, float]], road_factor: float = 1.3) -> List[List[float]]:
    """Symmetric matrix of estimated road distances (km). points[0] is the depot."""
    n = len(points)
    d = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            km = haversine_km(points[i], points[j]) * road_factor
            d[i][j] = d[j][i] = km
    return d
