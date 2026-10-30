# Memória hidráulica — Gen E rev. 5, polpa de 8% ST (documento de trabalho)

Situação: **PROPOSTA DE TRABALHO, NÃO LIBERADA.** Revisão 5: planta enxuta, sem tanque de neutralização, alinhada à F02 Rev. B (C1) do chat de fluxogramas. Precisa do Crivo A–F independente. Cotas na base comum z = 0 (premissa de S5). Sem valores monetários.

## 1. Premissas e método

- **Vazão de projeto: 6 m³/h** (máximo das PCP; pulsos). A linha de 20 m³/h nas saídas só mostra folga.
- **Reologia:** plástico de Bingham.
  - Tubo cheio: Buckingham–Reiner e Darby–Mun–Boger.
  - Partida: 4·τy·L/(ρ·g·D).
  - Lâmina livre: sen θ ≥ τy/(ρ·g·0,304·D).
  - Singulares pelo 2-K de Hooper com o Re de Metzner–Reed.
- **Três casos de reologia**, hipótese até a reometria (LAC-041):

| caso | τy (Pa) | μp (Pa·s) | ρ (kg/m³) |
|---|---|---|---|
| otimista | 5 | 0,02 | 1030 |
| central | 30 | 0,06 | 1030 |
| pessimista | 100 | 0,20 | 1030 |

- **Espaço de gás:** ≈ 0 a +2 mbar (ligado à bolsa GH-1 que recebe). Nas verificações de nível usei 0 mbar e no gráfico +3,5 mbar.
- **NPSH:** P_atm 91,3 kPa (Congonhas/MG, ≈ 870 m; LAC-027) e P_vapor 5,6 kPa.

## 2. Arranjo da rev. 5

**R-101 (acidogênico).**
- Recebe da P-101 pelo tampo, em **descarga direta** no N1, sem tubo de imersão. A saída é pelo fundo, então não há curto-circuito, e o quebra-sifão é inerente.
- Sai pelo fundo (N2-135) para a P-201. O nível é variável, com controle por LT, e não há saída por transbordo.
- Pulmão entre LSL (+2,80) e o nível de operação (+3,50): ≈ 5,6 m³. Isso cobre o pulmão que o TQ-201 fazia (≈ 1 m³).

**Neutralização em linha, sem TQ-201:**
- **Na sucção da P-201** entra o retorno alcalino do digestato (RL-05). A mistura acontece na própria PCP.
- **Na descarga** entra a dosagem de NaOH ou bicarbonato (DOS-201), antes do misturador estático MX-201.
- **Medição:** pH/ORP em linha (AIT-201) na entrada dos metanogênicos e pH/ORP no copo de saída de cada metanogênico (AIT-212/222 na CS-301). O AIC-201 comanda a dosadora e a razão do RL-05.
- **Por que funciona sem tanque:** cada pulso tem ≈ 0,6 m³, cerca de 0,7% do volume de um metanogênico de 85 m³. O reator dilui e tampona o pulso, e a dosagem em linha corrige o pH antes da entrada.
- **Riscos registrados:**
  - falha da dosagem durante um pulso: o pulso é intertravado com o pH em linha dentro da faixa;
  - item FINEP "tanques de neutralização" (LAC-054).

**Alimentação dos R-201/202 pelo tampo com tubo de imersão** (C1 da F02 Rev. B):
- Pulsos alternados pela XV-211 e pela XV-221, com volume por pulso no FQIT-201.
- Quebra-sifão passivo pelo furo do tubo no espaço de gás, sem ventosa em lodo.
- **Boca do tubo de imersão a +6,1 m.** A imersão fica limitada a ≈ 2,25 m abaixo do LSHH, para que, mesmo com τy = 100 Pa, a polpa dentro do tubo não suba até o furo quebra-sifão (+9,05).
  - Com isso a entrada fica 1,4 m abaixo do N.A. O curto-circuito até o N-SAI é controlado pelo pulso pequeno e pelo intertravamento com o misturador.
  - Ensaio de traçador na partida (LAC-047).

**Saídas dos R-201/202 sem mudança:** bocal N-SAI no nível, respiro de equalização, descida livre e copos de selagem na CS-301 no chão. A saída por coluna a partir do N2 (C1) não foi adotada: deixa ≈ 7 m de tubo cheio de polpa e, com τy alto, o nível passaria do tampo.

**Purgas dos R-201/202 pela P-301:**
- Manifold de sucção com chave presa, uma sucção por vez: CS-301, N3 do TQ-301, purga do R-201 ou purga do R-202.
- A vazão fica limitada pela bomba, e a purga só abre com reposição de gás pela bolsa GH-1 que recebe.

## 3. Saídas por gravidade (R-201/202 → copos na CS-301)

| reator | caso | Q (m³/h) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) | carga no copo (m) | folga na soleira (m) | sen θ mín. exigido | sen θ adotado | selo (mm / mbar) |
|---|---|---|---|---|---|---|---|---|---|---|
| R-201 | otimista | 6 | 0,06 | 7,56 | 0,64 | 0,02 | 5,98 | 0,012 | 0,71 | 330 / 33 |
| R-202 | otimista | 6 | 0,06 | 7,56 | 0,64 | 0,02 | 5,98 | 0,012 | 0,71 | 330 / 33 |
| R-201 | otimista | 20 | 0,10 | 7,60 | 0,60 | 0,03 | 5,97 | 0,012 | 0,71 | 330 / 33 |
| R-202 | otimista | 20 | 0,10 | 7,60 | 0,60 | 0,03 | 5,97 | 0,012 | 0,71 | 330 / 33 |
| R-201 | central | 6 | 0,19 | 7,69 | 0,51 | 0,07 | 5,93 | 0,069 | 0,71 | 330 / 33 |
| R-202 | central | 6 | 0,19 | 7,69 | 0,51 | 0,07 | 5,93 | 0,069 | 0,71 | 330 / 33 |
| R-201 | central | 20 | 0,23 | 7,73 | 0,47 | 0,09 | 5,91 | 0,069 | 0,71 | 330 / 33 |
| R-202 | central | 20 | 0,23 | 7,73 | 0,47 | 0,09 | 5,91 | 0,069 | 0,71 | 330 / 33 |
| R-201 | pessimista | 6 | 0,53 | 8,03 | 0,17 | 0,27 | 5,73 | 0,231 | 0,71 | 330 / 33 |
| R-202 | pessimista | 6 | 0,53 | 8,03 | 0,17 | 0,27 | 5,73 | 0,231 | 0,71 | 330 / 33 |
| R-201 | pessimista | 20 | 0,59 | 8,09 | 0,11 | 0,31 | 5,69 | 0,231 | 0,71 | 330 / 33 |
| R-202 | pessimista | 20 | 0,59 | 8,09 | 0,11 | 0,31 | 5,69 | 0,231 | 0,71 | 330 / 33 |

- **Volume que ainda chega à CS-301 depois de um corte** (um reator por vez): 0,71 m³, contra 0,82 m³ entre LSHH e extravasor.

## 4. Trens bombeados (Q = 6 m³/h)

A coluna **folga no furo** é a cota do furo quebra-sifão menos a superfície da polpa dentro do tubo de imersão. Precisa ser positiva: a polpa não pode subir até o furo e derramar por ele no espaço de gás.

| trem | caso | perda sucção (m) | perda recalque (m) | AMT (m) | AMT (bar) | pressão na crista (m) | folga no furo (m) | p. sucção no flange (m) | NPSHd (m) |
|---|---|---|---|---|---|---|---|---|---|
| P-101 → R-101 | otimista | 0,00 | 0,60 | 4,94 | 0,50 | 0,03 | — | — | — |
| P-201 → R-201 | otimista | 0,12 | 1,07 | 8,53 | 0,86 | 0,03 | 0,66 | 2,38 | 10,87 |
| P-201 → R-202 | otimista | 0,12 | 1,41 | 8,82 | 0,89 | 0,03 | 0,66 | 2,38 | 10,87 |
| P-301 → TQ-301 (transferência) | otimista | 0,03 | 0,54 | 5,71 | 0,58 | — | — | 0,22 | 8,70 |
| P-301 → sucção da P-201 (RL-05) | otimista | 0,03 | 1,18 | 4,71 | 0,48 | — | — | 0,22 | 8,70 |
| P-301 ← TQ-301 (recirculação/expedição) | otimista | 0,28 | 0,54 | 5,46 | 0,55 | — | — | 0,47 | 8,95 |
| Purga R-201 → P-301 → TQ-301 | otimista | 0,43 | 0,54 | -0,19 | -0,02 | — | — | 6,12 | 14,60 |
| Purga R-202 → P-301 → TQ-301 | otimista | 0,53 | 0,54 | -0,10 | -0,01 | — | — | 6,02 | 14,50 |
| P-101 → R-101 | central | 0,00 | 3,22 | 7,16 | 0,72 | 0,03 | — | — | — |
| P-201 → R-201 | central | 0,67 | 5,78 | 13,39 | 1,35 | 0,03 | 0,49 | 1,83 | 10,31 |
| P-201 → R-202 | central | 0,67 | 7,57 | 14,99 | 1,51 | 0,03 | 0,49 | 1,83 | 10,31 |
| P-301 → TQ-301 (transferência) | central | 0,19 | 2,96 | 8,29 | 0,84 | — | — | 0,06 | 8,54 |
| P-301 → sucção da P-201 (RL-05) | central | 0,19 | 6,40 | 10,09 | 1,02 | — | — | 0,06 | 8,54 |
| P-301 ← TQ-301 (recirculação/expedição) | central | 1,63 | 2,96 | 9,23 | 0,93 | — | — | -0,88 | 7,61 |
| Purga R-201 → P-301 → TQ-301 | central | 2,49 | 2,96 | 4,29 | 0,43 | — | — | 4,06 | 12,54 |
| Purga R-202 → P-301 → TQ-301 | central | 3,04 | 2,96 | 4,85 | 0,49 | — | — | 3,51 | 11,99 |
| P-101 → R-101 | pessimista | 0,00 | 10,68 | 13,87 | 1,40 | 0,43 | — | — | — |
| P-201 → R-201 | pessimista | 2,23 | 19,21 | 27,70 | 2,80 | 0,52 | 0,02 | 0,27 | 8,76 |
| P-201 → R-202 | pessimista | 2,23 | 25,15 | 33,64 | 3,40 | 1,13 | 0,02 | 0,27 | 8,76 |
| P-301 → TQ-301 (transferência) | pessimista | 0,62 | 9,84 | 15,61 | 1,58 | — | — | -0,37 | 8,11 |
| P-301 → sucção da P-201 (RL-05) | pessimista | 0,62 | 21,26 | 25,38 | 2,56 | — | — | -0,37 | 8,11 |
| P-301 ← TQ-301 (recirculação/expedição) | pessimista | 5,41 | 9,84 | 19,90 | 2,01 | — | — | -4,66 | 3,82 |
| Purga R-201 → P-301 → TQ-301 | pessimista | 8,30 | 9,84 | 16,98 | 1,72 | — | — | -1,75 | 6,73 |
| Purga R-202 → P-301 → TQ-301 | pessimista | 10,13 | 9,84 | 18,82 | 1,90 | — | — | -3,58 | 4,90 |

Leitura da tabela:

- **Maior AMT:** P-201 → R-202 (pessimista), 3,40 bar.
  - PCP de ≥ 2 estágios.
  - PSV com retorno, PSHH e PSL.
- **Menor NPSHd:** 3,82 m (P-301 ← TQ-301 (recirculação/expedição), pessimista). Especificar NPSHr ≤ 3 m.
- **Menor folga no furo do tubo de imersão:** 0,02 m (P-201 → R-201, pessimista).
- **AMT negativa nas purgas:** com τy baixo a AMT fica negativa e a P-301 trabalha como freio volumétrico.
  - Inversor com frenagem.
  - A XV de purga abre só com a bomba em marcha e fecha com ela.

## 5. Linhas de energia e piezométricas

![LE e LP](LE_LP_gene.png)

- **Lâmina livre:** a LP é a superfície da polpa.
- **No copo:** a LP cai pelo tubo mergulhado e pelo ânulo.
- **Alimentação pelo tampo:** a LP fica no mínimo na crista da travessia mais o gás. O furo do tubo de imersão admite gás quando ela cai abaixo disso.
- **Velocidade:** v²/2g < 1 cm, então a LE se sobrepõe à LP.

## 6. Lacunas

Ver `LACUNAS_PROPOSTAS.md`. As que decidem esta memória:
- LAC-041: reometria.
- LAC-046: selo de 330 mm.
- LAC-047: tubo de imersão e estruturas (Fibrais).
- LAC-054: FINEP e tanque de neutralização.
- LAC-055: dados de alcalinidade e AGV para a dosagem.
