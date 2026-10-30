"""Escoamento de polpa com tensão de escoamento (plástico de Bingham), unidades SI.

Uso típico: lodo/digestato de 4–8% ST. A polpa só escoa quando a tensão na parede supera a
tensão de escoamento τy; parada, ela segura carga sem escoar.

- Tubo cheio, laminar: Buckingham–Reiner (solução exata para Bingham).
- Transição e turbulento: correlação de Darby, Mun e Boger (1992) para o fator de atrito de
  Fanning de plástico de Bingham, combinada com o laminar pela regra de Darby.
- Partida: o tubo cheio só começa a escoar com gradiente ≥ 4·τy / D.
- Escoamento livre (canal/tubo parcialmente cheio): só escoa se ρ·g·S·Rh > τy; com Rh máximo
  de tubo circular ≈ 0,304·D (lâmina a 81% do diâmetro) dá a declividade mínima.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

G = 9.81


@dataclass(frozen=True)
class Bingham:
    nome: str
    tau_y: float      # Pa
    mu_p: float       # Pa·s (viscosidade plástica)
    rho: float = 1030.0


def _q_buckingham(tau_w: float, D: float, f: Bingham) -> float:
    """Vazão (m³/s) para a tensão na parede tau_w num tubo de diâmetro D (laminar)."""
    if tau_w <= f.tau_y:
        return 0.0
    x = f.tau_y / tau_w
    R = D / 2
    return math.pi * R ** 3 * tau_w / (4 * f.mu_p) * (1 - 4 / 3 * x + x ** 4 / 3)


def tau_w_laminar(Q: float, D: float, f: Bingham) -> float:
    """Tensão na parede (Pa) para escoar Q (m³/s) em regime laminar (bisseção)."""
    if Q <= 0:
        return f.tau_y
    lo, hi = f.tau_y, f.tau_y + 10.0
    while _q_buckingham(hi, D, f) < Q:
        hi *= 2
    for _ in range(200):
        mid = (lo + hi) / 2
        if _q_buckingham(mid, D, f) < Q:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def fanning(Q: float, D: float, f: Bingham) -> tuple[float, float, float]:
    """(f_Fanning, Re_Bingham, Hedström) pela correlação de Darby–Mun–Boger."""
    A = math.pi * D ** 2 / 4
    v = Q / A
    re = f.rho * v * D / f.mu_p
    he = f.rho * f.tau_y * D ** 2 / f.mu_p ** 2
    tau_l = tau_w_laminar(Q, D, f)
    f_l = 2 * tau_l / (f.rho * v ** 2)
    a = -1.47 * (1 + 0.146 * math.exp(-2.9e-5 * he))
    f_t = 10 ** a * re ** -0.193
    m = 1.7 + 40000 / re
    hi, lo = max(f_l, f_t), min(f_l, f_t)
    return hi * (1 + (lo / hi) ** m) ** (1 / m), re, he   # (f_l^m + f_t^m)^(1/m) sem overflow


def perda_tubo(Q_m3h: float, D: float, L: float, f: Bingham) -> dict:
    """Perda de carga (m de coluna de polpa) num trecho cheio de comprimento L (m)."""
    Q = Q_m3h / 3600
    A = math.pi * D ** 2 / 4
    v = Q / A
    ff, re, he = fanning(Q, D, f)
    tau_w = ff * f.rho * v ** 2 / 2
    hf = 4 * tau_w * L / (f.rho * G * D)
    return {"v": v, "Re_B": re, "He": he, "f": ff, "tau_w": tau_w, "hf": hf,
            "laminar": re < 2100 * (1 + he / 12000) ** 0.4}


def carga_partida(D: float, L: float, f: Bingham) -> float:
    """Carga (m de polpa) para romper a tensão de escoamento num trecho cheio de L (m)."""
    return 4 * f.tau_y * L / (f.rho * G * D)


def declividade_minima_livre(D: float, f: Bingham) -> float:
    """Declividade (m/m) abaixo da qual a polpa para num tubo parcialmente cheio."""
    rh_max = 0.304 * D
    return f.tau_y / (f.rho * G * rh_max)


def carga_cinetica(Q_m3h: float, D: float) -> float:
    v = Q_m3h / 3600 / (math.pi * D ** 2 / 4)
    return v ** 2 / (2 * G)


# Faixa de sensibilidade adotada para polpa de 8% ST (HIPÓTESE até a reometria da polpa
# real). Âncoras: lodo digerido a 4,5% ST com τy de 0,56–12,6 Pa e viscosidade aparente de
# 0,1–3,2 Pa·s a 10 s⁻¹ (Tabatabaei et al., 2025, 11 ETEs); τy crescendo em lei de potência
# com o ST (Markis et al., 2014; Jiang et al., 2014). Extrapolar 4,5 → 8% ST com expoente
# 2,5–3,2 leva o limite superior a ~50–80 Pa; o caso pessimista (100 Pa) cobre fibra de
# resíduo alimentar. Digestato de resíduo sólido a 20–30% ST chega a 200–800 Pa
# (Loisel et al., 2011): fora da faixa desta planta.
CASOS_8ST = (
    Bingham("otimista", tau_y=5.0, mu_p=0.02),
    Bingham("central", tau_y=30.0, mu_p=0.06),
    Bingham("pessimista", tau_y=100.0, mu_p=0.20),
)
