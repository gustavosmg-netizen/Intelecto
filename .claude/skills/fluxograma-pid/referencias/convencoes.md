# Convenções de P&ID — padrão proposto da casa

> Padrão **proposto** para quando o cliente não fixar o seu. Se houver padrão do cliente
> (Vale/MACh, concessionária, Petrobras N-58), ele prevalece — registrar na spec a origem.

## Identificação de equipamentos (TAG = PREFIXO-ÁREA+SEQ)

Área = centena (100 elevatória/pré-tratamento, 200 equalização/primário, 300 biológico,
400 secundário/terciário, 500 desinfecção, 600 lodo, 700 química, 800 utilidades).
Reserva com sufixo de letra: `B-101A` (operação) / `B-101B` (reserva).

| Prefixo | Equipamento | Símbolo do catálogo |
|---|---|---|
| B | Bomba centrífuga / submersível | `centrifugal_pump` |
| BD | Bomba dosadora / volumétrica / helicoidal | `pd_pump` |
| SP | Soprador | `fan` (ou `compressor`) |
| MX | Misturador / agitador | `agitator` sobre o tanque (porta `shaft`) |
| TQ | Tanque, poço, câmara, reator (concreto ou metálico) | `tank` (`roof`: `flat`/`cone`) |
| RT | Reator fechado / UASB | `reactor` ou `vertical_vessel` + `desc` |
| DC | Decantador / adensador | `tank` + `desc` ("DECANTADOR SECUNDÁRIO C/ RASPADOR") |
| SL | Silo / tremonha | `hopper` |
| FT | Filtro | `filter` |
| GR | Gradeamento / peneira | `filter` + `desc` ("GRADEAMENTO MÉDIO e=20 mm") — provisório |
| TC | Trocador de calor | `shell_tube_hx` / `plate_hx` |

## Válvulas (registros) — TAG = PREFIXO-ÁREA+SEQ

| Prefixo | Válvula | Símbolo / atuador |
|---|---|---|
| RG | Registro de gaveta | `gate`, `actuator: hand` |
| RB | Válvula borboleta manual | `butterfly`, `hand` |
| RE | Registro de esfera | `ball`, `hand` |
| VR | Válvula de retenção | `check` |
| VA | Válvula de alívio / segurança | `relief` |
| VD | Válvula diafragma (química) | `diaphragm`, `hand` |
| XV | Válvula on-off atuada | `butterfly`/`ball` com `motor`, `solenoid` ou `piston` |
| FCV/LCV/PCV | Válvula de controle (ISA) | `globe` com `diaphragm`, e `fail` FO/FC/FL |

Comporta e stop-log: sem símbolo — use `gate` com `desc` "COMPORTA" e nota na folha.

## Instrumentos — ISA-5.1 (compatível com NBR 8190)

TAG = LETRAS-ÁREA+SEQ (`LIT-101`, `FIT-201`, `AIT-301`). Conferir com `pid_tag_parse`.
Comuns em saneamento: `LIT` nível, `LSH/LSL` chave de nível alto/baixo, `FIT` vazão
(eletromagnético), `PIT` pressão, `AIT` analisador (OD, pH, turbidez, cloro — informar o
parâmetro na nota), `TIT` temperatura. `type: plc` para sinais no CLP; `field` para
instrumento de campo.

## Numeração de linha: DN-SERVIÇO-SEQ-MATERIAL

Ex.: `150-EB-001-PVC`, `100-LM-006-PEAD`, `80-AR-005-AC`. A mesma linha continua com o mesmo
número através de válvulas; muda quando muda DN, material ou serviço. Reserva/paralela:
sufixo de letra na sequência (`001B`).

| Código | Serviço |
|---|---|
| EB | Esgoto bruto |
| EP | Esgoto pré-tratado / primário |
| EQ | Esgoto equalizado |
| LM | Licor misto |
| ET | Efluente tratado |
| LO | Lodo (LP primário, LA ativado/retorno, LE excesso) |
| AR | Ar de processo |
| AB | Água bruta |
| AT | Água tratada / potável |
| AS | Água de serviço |
| QM | Produto químico (indicar o produto na nota) |
| DR | Dreno / extravasor |
| BG | Biogás |

Materiais: PVC, PEAD, FOFO (ferro fundido), AC (aço carbono), INOX, PRFV.

## Classes de linha (`class`)

`process_major` processo principal · `process_minor` secundário/dreno/amostragem ·
`utility` ar, água de serviço, química · `electric` sinal elétrico (tracejado) ·
`pneumatic` sinal pneumático · `data` rede/comunicação.
