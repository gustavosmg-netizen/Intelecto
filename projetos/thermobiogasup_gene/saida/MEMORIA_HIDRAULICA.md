# Memória hidráulica — cascata Gen E com polpa de 8% ST (documento de trabalho)

Situação: **PROPOSTA DE TRABALHO**, não liberada. Falta o Crivo A–F por revisor independente (CLAUDE.md do projeto). Cotas na base comum z = 0 (premissa a confirmar em S5). Sem valores monetários.

## 1. Premissas

- Vazão de projeto das saídas por gravidade: **6 m³/h**. É a vazão máxima das PCP de alimentação (2–6 m³/h), e em regime o que entra é o que sai. 20 m³/h (Q_máx de retirada) aparece só como verificação de folga: retiradas são bombeadas, não saem pelo transbordo.
- Reologia: plástico de Bingham. Escoamento cheio por Buckingham–Reiner (laminar) e Darby–Mun–Boger (transição/turbulento). Partida: 4·τy·L/(ρ·g·D). Lâmina livre: S ≥ τy/(ρ·g·0,304·D). Perdas localizadas pelo 2-K de Hooper com Re de Bingham.
- Três casos (HIPÓTESE até a reometria da polpa real, **LAC-041**):

| caso | τy (Pa) | μp (Pa·s) | ρ (kg/m³) |
|---|---|---|---|
| otimista | 5 | 0,02 | 1030 |
| central | 30 | 0,06 | 1030 |
| pessimista | 100 | 0,20 | 1030 |

- Espaço de gás: operação +1,5 a +3,5 mbar; nas verificações de nível foi usado 0 mbar (partida, conservador, porque a pressão do gás ajuda a empurrar a polpa pelo U).
- NPSH: P_atm 101.3 kPa (nível do mar; a altitude é lacuna de S5) e P_vapor 5.6 kPa (35 °C).

## 2. Saídas por gravidade (N-SAI DN150 → standpipe → crista → descida a 45° → U)

Leitura: *nível máx.* é o nível que o reator atinge para escoar Q. Ele soma a crista, a lâmina crítica, a carga do lado do reator e, se o U pedir mais carga que a crista oferece, o afogamento do ramo descendente. A *folga na crista* é a crista menos a superfície no ramo descendente do U: se for negativa, o U afoga a crista e o nível sobe junto. O selo é medido do topo interno do fundo do U ao fundo interno da saída.

| reator | caso | Q (m³/h) | nível máx. (m) | folga até LSH (m) | folga na crista (m) | carga no U (m) | tubo cheio (m) | decl. mín. livre (m/m) | decl. adotada | selo (mm / mbar) |
|---|---|---|---|---|---|---|---|---|---|---|
| R-101 | otimista | 6 | 3,56 | 0,54 | 1,17 | 0,07 | 2,1 | 0,012 | 1,00 | 330 / 33 |
| R-201 | otimista | 6 | 7,56 | 0,54 | 1,59 | 0,07 | 2,2 | 0,012 | 1,00 | 330 / 33 |
| R-202 | otimista | 6 | 7,56 | 0,54 | 1,58 | 0,08 | 2,3 | 0,012 | 1,00 | 330 / 33 |
| R-101 | otimista | 20 | 3,62 | 0,48 | 1,12 | 0,13 | 2,2 | 0,012 | 1,00 | 330 / 33 |
| R-201 | otimista | 20 | 7,62 | 0,48 | 1,53 | 0,13 | 2,2 | 0,012 | 1,00 | 330 / 33 |
| R-202 | otimista | 20 | 7,62 | 0,48 | 1,52 | 0,14 | 2,4 | 0,012 | 1,00 | 330 / 33 |
| R-101 | central | 6 | 3,66 | 0,44 | 0,98 | 0,26 | 2,4 | 0,069 | 1,00 | 330 / 33 |
| R-201 | central | 6 | 7,66 | 0,44 | 1,40 | 0,26 | 2,3 | 0,069 | 1,00 | 330 / 33 |
| R-202 | central | 6 | 7,66 | 0,44 | 1,37 | 0,29 | 2,6 | 0,069 | 1,00 | 330 / 33 |
| R-101 | central | 20 | 3,74 | 0,36 | 0,89 | 0,35 | 2,5 | 0,069 | 1,00 | 330 / 33 |
| R-201 | central | 20 | 7,74 | 0,36 | 1,31 | 0,35 | 2,4 | 0,069 | 1,00 | 330 / 33 |
| R-202 | central | 20 | 7,74 | 0,36 | 1,28 | 0,38 | 2,8 | 0,069 | 1,00 | 330 / 33 |
| R-101 | pessimista | 6 | 3,96 | 0,14 | 0,07 | 1,17 | 3,7 | 0,231 | 1,00 | 330 / 33 |
| R-201 | pessimista | 6 | 7,96 | 0,14 | 0,51 | 1,15 | 3,6 | 0,231 | 1,00 | 330 / 33 |
| R-202 | pessimista | 6 | 7,96 | 0,14 | 0,36 | 1,30 | 4,1 | 0,231 | 1,00 | 330 / 33 |
| R-101 | pessimista | 20 | 4,22 | -0,12 ⚠ | -0,20 | 1,45 | 3,9 | 0,231 | 1,00 | 330 / 33 |
| R-201 | pessimista | 20 | 8,09 | 0,01 ⚠ | 0,16 | 1,50 | 4,1 | 0,231 | 1,00 | 330 / 33 |
| R-202 | pessimista | 20 | 8,09 | 0,01 ⚠ | -0,01 | 1,67 | 4,6 | 0,231 | 1,00 | 330 / 33 |

Conclusões das saídas:

1. **A saída por gravidade de polpa a 8% ST funciona** na vazão de projeto nos três casos de reologia. Isso vale para este arranjo: crista no nível, descidas a 45° (S = 1,0, contra o mínimo de 0,23 no caso pessimista) e só o U e a saída curta trabalhando cheios.
2. O trecho crítico é o **U do R-101 → TQ-201**. Nele cabe menos desnível entre a crista (+3,50) e a entrada do TQ-201 (+2,26). No caso pessimista sobram poucos centímetros na crista. O nível do reator continua abaixo do LSH, então a margem depende da reometria (LAC-041). Contingência, se τy > 100 Pa: U em DE200 (a carga cai cerca de 20%) ou rebaixar a entrada do TQ-201.
3. **Selo de 330 mm de polpa** (≈ 33 mbar). É 2,7× a abertura do dispositivo de emergência (+12 mbar), 4× o vácuo de projeto (−8 mbar) e passa os ≥ 250 mm da RES-001 LQ-04. A proposta citava 500 mmCA, mas com τy alto um U mais fundo pede tanto tubo cheio que a polpa afoga a crista do R-101. **Divergência a validar com o responsável de processo.**
4. Q = 20 m³/h por gravidade só ocorreria com alimentação de 20 m³/h, que as PCP não entregam. No caso pessimista a esse fluxo o LSH seria atingido: o sistema falha para o lado seguro (alarme e corte da alimentação), sem sobrepressão.

## 3. Trens bombeados (Q = 6 m³/h)

| trem | caso | perda sucção (m) | perda recalque (m) | AMT (m) | AMT (bar) | p. sucção no flange (m) | NPSHd (m) |
|---|---|---|---|---|---|---|---|
| P-101 → R-101 | otimista | 0,00 | 0,29 | 4,38 | 0,44 | 0,00 | — |
| P-201 → R-201 | otimista | 0,08 | 0,42 | 8,99 | 0,91 | 0,11 | 9,58 |
| P-201 → R-202 | otimista | 0,08 | 0,88 | 9,44 | 0,95 | 0,11 | 9,58 |
| P-301 → TQ-301 (recirculação) | otimista | 0,07 | 0,40 | 5,36 | 0,54 | 0,68 | 10,15 |
| P-301 → TQ-201 (RL-05) | otimista | 0,07 | 0,85 | 3,22 | 0,33 | 0,68 | 10,15 |
| Purga R-201 → P-301 | otimista | 0,18 | 0,40 | -0,87 | -0,09 | 6,91 | 16,38 |
| Purga R-101 → P-201 | otimista | 0,16 | 0,42 | 6,33 | 0,64 | 2,76 | 12,23 |
| P-101 → R-101 | central | 0,00 | 1,48 | 5,57 | 0,56 | 0,00 | — |
| P-201 → R-201 | central | 0,43 | 2,12 | 11,04 | 1,12 | -0,24 | 9,23 |
| P-201 → R-202 | central | 0,43 | 4,55 | 13,47 | 1,36 | -0,24 | 9,23 |
| P-301 → TQ-301 (recirculação) | central | 0,40 | 2,11 | 7,39 | 0,75 | 0,35 | 9,83 |
| P-301 → TQ-201 (RL-05) | central | 0,40 | 4,45 | 7,15 | 0,72 | 0,35 | 9,83 |
| Purga R-201 → P-301 | central | 0,99 | 2,11 | 1,66 | 0,17 | 6,09 | 15,56 |
| Purga R-101 → P-201 | central | 0,90 | 2,12 | 8,77 | 0,89 | 2,03 | 11,50 |
| P-101 → R-101 | pessimista | 0,00 | 4,89 | 8,98 | 0,91 | 0,00 | — |
| P-201 → R-201 | pessimista | 1,42 | 7,02 | 16,92 | 1,71 | -1,23 | 8,24 |
| P-201 → R-202 | pessimista | 1,42 | 15,09 | 24,99 | 2,53 | -1,23 | 8,24 |
| P-301 → TQ-301 (recirculação) | pessimista | 1,31 | 6,99 | 13,19 | 1,33 | -0,56 | 8,91 |
| P-301 → TQ-201 (RL-05) | pessimista | 1,31 | 14,78 | 18,39 | 1,86 | -0,56 | 8,91 |
| Purga R-201 → P-301 | pessimista | 3,30 | 6,99 | 8,84 | 0,89 | 3,78 | 13,25 |
| Purga R-101 → P-201 | pessimista | 2,99 | 7,02 | 15,76 | 1,59 | -0,06 | 9,41 |

- Maior AMT: **P-201 → R-202** no caso pessimista: 2,53 bar. Especificar as PCP P-201 e P-301 para ≥ 4 bar (2 estágios) cobre o caso pessimista com folga. A pressão da P-101 no tie-in sai da tabela (trem P-101 → R-101).
- A sucção é sempre positiva nos tanques. Nas purgas, a sucção depende do nível do reator: PSL na sucção e intertravamento de proteção contra marcha a seco (VC-11).

## 4. TQ-201 (neutralização), Ø1,80 m, fundo a +0,45

| nível | cota (m) | volume (m³) |
|---|---|---|
| LSLL | 0,80 | 0,89 |
| LSL | 0,95 | 1,27 |
| LSH | 1,40 | 2,42 |
| LSHH | 1,55 | 2,80 |
| extravasor | 1,70 | 3,18 |
| entrada | 2,18 | 4,40 |

- Volume útil LSL→LSH 1,15 m³. Detenção até o LSH a 6 m³/h: 24 min (neutralização de pH: 10–30 min usuais).
- Pulmão LSH→LSHH 3,8 min; LSHH→extravasor 3,8 min, para o intertravamento cortar a P-101 antes de transbordar.
- O extravasor DN150 por lâmina livre comporta a vazão máxima de entrada com folga, e a soleira de entrada fica a ≥ 3·DI acima dele (air gap).

## 5. Linhas de energia e piezométricas

![LE e LP](LE_LP_gene.png)

- No escoamento livre (descidas) a LP coincide com a superfície da polpa e a LE fica v²/2g acima. As velocidades são de 0,1 a 0,4 m/s, então v²/2g fica abaixo de 1 cm e as duas linhas se sobrepõem na escala do gráfico.
- A LP sobe na bomba (AMT) e cai com o atrito. Nas alças, ela termina na crista ventilada ao gás do reator, que quebra o sifão.
- O salto do gás (+3,5 mbar ≈ 3,5 cm) aparece na LP do lado do reator e se desfaz na saída do U, que descarrega à pressão atmosférica.

## 6. Lacunas abertas por este cálculo

- **LAC-041**: reometria da polpa real (τy, μp a 35 °C, 6–9% ST). Ela fecha a margem do U do R-101.
- Altitude do sítio (NPSH) e confirmação da base comum z = 0 (S5).
