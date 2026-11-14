"""Small statistics helpers kept dependency-free (the backend only needs NumPy for sampling)."""

from __future__ import annotations

from statistics import NormalDist

_NORMAL = NormalDist()


def normal_cdf(z: float) -> float:
    return _NORMAL.cdf(z)


def student_t_quantile(p: float, df: int) -> float:
    """Quantile of Student's t with `df` degrees of freedom.

    Cornish-Fisher expansion around the normal quantile (Abramowitz & Stegun, 1964, 26.7.5);
    within 0.005 of exact tables for df >= 4 and the tail probabilities used here.
    """
    if df < 1:
        raise ValueError("Student's t needs at least 1 degree of freedom")
    if not 0.0 < p < 1.0:
        raise ValueError("Probability must be strictly between 0 and 1")
    z = _NORMAL.inv_cdf(p)
    g1 = (z**3 + z) / 4
    g2 = (5 * z**5 + 16 * z**3 + 3 * z) / 96
    g3 = (3 * z**7 + 19 * z**5 + 17 * z**3 - 15 * z) / 384
    g4 = (79 * z**9 + 776 * z**7 + 1482 * z**5 - 1920 * z**3 - 945 * z) / 92160
    return z + g1 / df + g2 / df**2 + g3 / df**3 + g4 / df**4
