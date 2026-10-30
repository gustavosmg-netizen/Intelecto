"""Tabelas dimensionais para tubulações de PVC e PEAD, flanges e válvulas (mm).

Confiança: o diâmetro externo (DE) e a furação de flanges seguem as normas citadas.
Espessuras de parede de PVC, comprimentos face a face e envelopes de válvulas e bombas
são valores típicos de catálogo para representação 3D: conferir o fabricante antes de
usar em lista de compra.
"""
from __future__ import annotations

from dataclasses import dataclass

# --- Tubos --------------------------------------------------------------------------

# PVC esgoto coletor, junta elástica (NBR 7362): DN -> DE
PVC_ESGOTO_DE = {100: 110, 150: 160, 200: 200, 250: 250, 300: 315, 350: 355, 400: 400}
# PVC esgoto predial série normal (NBR 5688): DN -> DE
PVC_PREDIAL_DE = {40: 40, 50: 50, 75: 75, 100: 100, 150: 150}
# PVC água PBA (NBR 5647): DN -> DE
PVC_PBA_DE = {50: 60, 75: 85, 100: 110}
# PVC água DEFOFO (DE igual ao ferro fundido, NBR 7675): DN -> DE
PVC_DEFOFO_DE = {100: 118, 150: 170, 200: 222, 250: 274, 300: 326, 350: 378, 400: 429,
                 500: 532}
# PEAD (NBR 15561 / ISO 4427): DEs comerciais
PEAD_DE = (20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280,
           315, 355, 400, 450, 500, 560, 630)
# DE do PEAD -> DN do flange/colarinho usual
PEAD_DN_FLANGE = {50: 40, 63: 50, 75: 65, 90: 80, 110: 100, 125: 100, 140: 125, 160: 150,
                  180: 150, 200: 200, 225: 200, 250: 250, 280: 250, 315: 300, 355: 350,
                  400: 400, 450: 450, 500: 500, 560: 500, 630: 600}

# SDR típico por material/classe (espessura = DE/SDR, mínimo construtivo 1,8 mm)
SDR_PADRAO = {"pvc_esgoto": 41, "pvc_predial": 51, "pvc_pba": 21, "pvc_defofo": 26,
              "pead": 17}
# Comprimento de barra (para juntas, bolsas e lista de material)
BARRA = {"pvc_esgoto": 6000, "pvc_predial": 6000, "pvc_pba": 6000, "pvc_defofo": 6000,
         "pead": 12000}
NOME_MATERIAL = {"pvc_esgoto": "PVC esgoto JE (NBR 7362)",
                 "pvc_predial": "PVC esgoto predial (NBR 5688)",
                 "pvc_pba": "PVC PBA JE (NBR 5647)", "pvc_defofo": "PVC DEFOFO JE",
                 "pead": "PEAD PE100 (NBR 15561)"}
# Vão máximo entre apoios de tubo cheio de água, horizontal (aprox. catálogo, mm)
VAO_MAX = {"pvc": {40: 800, 50: 900, 75: 1100, 100: 1300, 150: 1600, 200: 1900, 250: 2100,
                   300: 2300, 400: 2600},
           "pead": {50: 700, 63: 750, 75: 850, 90: 950, 110: 1050, 160: 1300, 200: 1500,
                    250: 1650, 315: 1850, 400: 2100}}


@dataclass(frozen=True)
class Tubo:
    material: str
    dn: int           # DN nominal (PVC) ou DE (PEAD)
    de: float         # diâmetro externo
    e: float          # espessura
    dn_flange: int    # DN do flange que conecta a este tubo

    @property
    def di(self) -> float:
        return self.de - 2 * self.e

    @property
    def descricao(self) -> str:
        if self.material == "pead":
            return f"PEAD DE{self.dn:g} SDR{round(self.de / self.e)}"
        return f"{NOME_MATERIAL[self.material].split(' (')[0]} DN{self.dn}"


def tubo(material: str, dn: int, sdr: float | None = None) -> Tubo:
    """Dimensões do tubo. Para PEAD, `dn` é o DE comercial."""
    sdr = sdr or SDR_PADRAO[material]
    if material == "pead":
        if dn not in PEAD_DE:
            raise ValueError(f"PEAD DE{dn} não é comercial; use um de {PEAD_DE}")
        de, dn_fl = float(dn), PEAD_DN_FLANGE.get(dn, dn)
    else:
        tabela = {"pvc_esgoto": PVC_ESGOTO_DE, "pvc_predial": PVC_PREDIAL_DE,
                  "pvc_pba": PVC_PBA_DE, "pvc_defofo": PVC_DEFOFO_DE}[material]
        if dn not in tabela:
            raise ValueError(f"{NOME_MATERIAL[material]} não tem DN{dn}; disponíveis: "
                             f"{sorted(tabela)}")
        de = float(tabela[dn])
        dn_fl = {75: 80}.get(dn, dn)  # PBA DN75 (DE85) usa adaptador para flange DN80
    return Tubo(material, dn, de, max(round(de / sdr, 1), 1.8), dn_fl)


def vao_maximo(t: Tubo) -> float:
    """Vão máximo entre apoios (DN para PVC, DE para PEAD; pega o menor diâmetro tabelado
    imediatamente abaixo, a favor da segurança)."""
    tab = VAO_MAX["pead" if t.material == "pead" else "pvc"]
    abaixo = [k for k in tab if k <= t.dn]
    return float(tab[max(abaixo)] if abaixo else tab[min(tab)])


# --- Flanges (ISO 7005 / EN 1092, PN10) -----------------------------------------------
# DN: (D externo, k = círculo de furação, n furos, Ø furo, parafuso, espessura)
FLANGE_PN10 = {
    40: (150, 110, 4, 19, "M16", 16), 50: (165, 125, 4, 19, "M16", 18),
    65: (185, 145, 8, 19, "M16", 18), 80: (200, 160, 8, 19, "M16", 20),
    100: (220, 180, 8, 19, "M16", 20), 125: (250, 210, 8, 19, "M16", 22),
    150: (285, 240, 8, 23, "M20", 22), 200: (340, 295, 8, 23, "M20", 24),
    250: (395, 350, 12, 23, "M20", 26), 300: (445, 400, 12, 23, "M20", 26),
    350: (505, 460, 16, 23, "M20", 28), 400: (565, 515, 16, 28, "M24", 28),
    450: (615, 565, 20, 28, "M24", 30), 500: (670, 620, 20, 28, "M24", 30),
    600: (780, 725, 20, 31, "M27", 32),
}
# PN16 difere do PN10 a partir do DN200 (furação/espessura)
FLANGE_PN16_DIF = {
    200: (340, 295, 12, 23, "M20", 24), 250: (405, 355, 12, 28, "M24", 26),
    300: (460, 410, 12, 28, "M24", 28), 350: (520, 470, 16, 28, "M24", 30),
    400: (580, 525, 16, 31, "M27", 32), 500: (715, 650, 20, 34, "M30", 34),
    600: (840, 770, 20, 37, "M33", 36),
}


@dataclass(frozen=True)
class Flange:
    dn: int
    pn: int
    D: float
    k: float
    n: int
    furo: float
    parafuso: str
    t: float

    @property
    def d_parafuso(self) -> float:
        return float(self.parafuso[1:])


# ASME/ANSI B16.5 classe 150 (furação dos bocais PRFV Fibrais: "FiberGlass ANSI B16.5").
# DN: (D externo, círculo de furação, n furos, Ø furo, parafuso, espessura do flange solto
# metálico). Os flanges PRFV dos desenhos Fibrais têm D maior (6": 290; 2": 161) e a mesma
# furação; o D e a espessura PRFV ficam em FLANGE_PRFV.
FLANGE_ANSI150 = {
    25: (108, 79.4, 4, 15.9, "M14", 14), 50: (152, 120.7, 4, 19.0, "M16", 17),
    80: (190, 152.4, 4, 19.0, "M16", 21), 100: (229, 190.5, 8, 19.0, "M16", 22),
    150: (279, 241.3, 8, 22.2, "M20", 24), 200: (343, 298.5, 8, 22.2, "M20", 27),
    250: (406, 362.0, 12, 25.4, "M22", 29), 300: (483, 431.8, 12, 25.4, "M22", 30),
    600: (813, 749.3, 20, 34.9, "M30", 48),
}
# Flanges PRFV Fibrais medidos nos desenhos 315A/D/E-25 (D externo, espessura adotada)
FLANGE_PRFV = {50: (161, 25), 150: (290, 30), 200: (343, 32), 600: (813, 40)}
CLASSE_ANSI = 150


def classe_txt(pn: int) -> str:
    """Rótulo de compra: 'ASME B16.5 Classe 150' (pn = 150) ou 'PN10/PN16' (EN/ISO)."""
    return "ASME B16.5 Classe 150" if pn == CLASSE_ANSI else f"PN{pn}"   # usar pn=150 nas linhas e portas para furação ANSI B16.5 classe 150


def flange(dn: int, pn: int = 10) -> Flange:
    if pn == CLASSE_ANSI:
        if dn not in FLANGE_ANSI150:
            raise ValueError(f"Sem flange ANSI 150# tabelado para DN{dn}")
        return Flange(dn, pn, *FLANGE_ANSI150[dn])
    if dn not in FLANGE_PN10:
        raise ValueError(f"Sem flange tabelado para DN{dn}")
    dados = FLANGE_PN16_DIF.get(dn) if pn == 16 else None
    return Flange(dn, pn, *(dados or FLANGE_PN10[dn]))


# --- Válvulas e conexões flangeadas (EN 558, face a face, mm) -------------------------
FF_GAVETA = {40: 140, 50: 150, 65: 170, 80: 180, 100: 190, 125: 200, 150: 210, 200: 230,
             250: 250, 300: 270, 350: 290, 400: 310, 500: 350, 600: 390}      # série 14
FF_BORBOLETA = {50: 43, 65: 46, 80: 46, 100: 52, 125: 56, 150: 56, 200: 60, 250: 68,
                300: 78, 350: 78, 400: 102, 500: 127, 600: 154}               # série 20
FF_RETENCAO = {40: 180, 50: 200, 65: 240, 80: 260, 100: 300, 125: 350, 150: 400, 200: 500,
               250: 600, 300: 700, 350: 800, 400: 900}                        # série 48
FF_ESFERA = {40: 165, 50: 178, 65: 190, 80: 203, 100: 229, 125: 356, 150: 394}  # série 27
FF_JUNTA_DESMONTAGEM = {50: 200, 65: 200, 80: 200, 100: 200, 125: 200, 150: 200, 200: 220,
                        250: 220, 300: 250, 350: 250, 400: 250, 500: 300, 600: 300}


def face_a_face(tipo: str, dn: int) -> float:
    tab = {"gaveta": FF_GAVETA, "borboleta": FF_BORBOLETA, "retencao": FF_RETENCAO,
           "esfera": FF_ESFERA, "junta_desmontagem": FF_JUNTA_DESMONTAGEM}[tipo]
    if dn not in tab:
        raise ValueError(f"{tipo} sem face a face tabelado para DN{dn}")
    return float(tab[dn])


# Ângulos comerciais de curvas (graus) e tolerância de deflexão em junta elástica
ANGULOS_COMERCIAIS = (90.0, 45.0, 22.5, 11.25)
TOLERANCIA_DEFLEXAO = 2.0

# Declividade mínima por diâmetro para condutos livres (m/m)
# NBR 8160 (predial): DN<=75 2 %, DN>=100 1 %; coletor público (NBR 9649) controla por
# tensão trativa: aqui só um piso conservador de 0,5 %.
def declividade_minima(material: str, dn: int) -> float:
    if material == "pvc_predial":
        return 0.02 if dn <= 75 else 0.01
    return 0.005

# Selo hídrico mínimo de sifão (NBR 8160: 50 mm; desconectores de ETE costumam usar 100)
SELO_MINIMO_PADRAO = 50.0
