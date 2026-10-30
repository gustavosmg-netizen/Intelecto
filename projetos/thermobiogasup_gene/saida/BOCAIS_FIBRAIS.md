# Lista de bocais De→Para — reatores e tanques PRFV (Gen E)

Situação: **DOCUMENTO DE TRABALHO — não liberado para emissão.** Revisão 3, depois de três rodadas do Crivo A–F independente, liberada para circular em discussão. **Não furar antes de fechar a LAC-006** (arranjo de bocais e saída nivelada, FEA da modificação) **e a LAC-031** (envelope garantido). Estanqueidade a gás de M1/A4/flanges cegos: LAC-029.

Convenções:
- Flanges com furação ASME B16.5 Classe 150, face plana (FF) no PRFV. Válvulas FF e junta full-face.
- Azimute horário a partir do 0° do desenho Fibrais, que deve coincidir com o norte de projeto na montagem.
- Cotas absolutas na base comum z = 0 (premissa de S5). Uso: alinhar com a Fibrais o que é aberto, novo e tamponado.

Legenda: **NOVO** = furar, laminar o pescoço com reforço (repad) e flangear. **TAMPONAR** = flange cego estanque a gás, com junta e parafusos. **CONVERTER** = adaptar o bocal para receber flange e cego.

## Resumo para a Fibrais

| equipamento | bocais novos (qtd × DN) | flanges cegos (qtd × DN) |
|---|---|---|
| R-101 | 1× DN50 + 1× DN150 | 2× DN150 + 1× DN200 + 1× DN600 |
| R-201 | 1× DN50 + 1× DN150 | 2× DN150 + 1× DN200 + 1× DN600 |
| R-202 | 1× DN50 + 1× DN150 | 2× DN150 + 1× DN200 + 1× DN600 |
| TQ-201 | 1× DN25 + 4× DN50 + 4× DN80 + 1× DN100 + 3× DN150 + 1× DN200 | — |
| TQ-301 | 1× DN50 + 1× DN150 | 4× DN150 + 1× DN600 |
| PS-101 | 2× DN150 | 2× DN50 |
| PS-201 | 2× DN150 | 2× DN50 |
| PS-202 | 2× DN150 | 2× DN50 |
| **total Fibrais (sem os potes)** | **1× DN25 + 8× DN50 + 4× DN80 + 1× DN100 + 7× DN150 + 1× DN200** | **10× DN150 + 3× DN200 + 4× DN600** |

Leitura do resumo:
- **Reatores e TQ-301 (já fabricados):** os bocais novos são só a saída N-SAI DN150, com a soleira interna no N.A. (+3,50 / +7,50), e o LSHH DN50.
- **Reatores, flanges cegos:** dois N2, o M1 e o A4. Os quatro N1 ficam em uso: respiro de equalização da saída, descarga da ventosa da alça, selo hidráulico e radar.
- **A4 (8"):** é convertido em flange com cego multitomada. É o candidato ao transbordo dedicado (LAC-038) e às tomadas independentes de PSLL/PAHH (LAC-048).
- **TQ-201:** todos os bocais são novos, porque o tanque é especificado pela CSTR (LAC-010).
- **Potes PS-101/201/202:** são itens novos da CSTR (PRFV ou PEAD), não da Fibrais.

## O que a Fibrais precisa confirmar ou fornecer antes de furar

- **Cargas nos bocais novos.** A N-SAI recebe só o registro e o tê do respiro. O pote tem estrutura própria até o piso, e a descida e o transbordo se apoiam numa estrutura metálica a projetar (LAC-047), não no bocal. A Fibrais informa as cargas admissíveis (forças e momentos) e o reforço (repad) de cada abertura nova, com a FEA da LAC-006.
- **Distância mínima de bocal à junta fundo-costado** (N-SUC a 250 mm e N-DRE a 200 mm do fundo do TQ-201).
- **Detalhes internos:** quebra-vórtice no N-SUC; tubos de imersão no N-DOS e no N-RL05.
- **Dilatação do PEAD** entre o piso e os bocais altos (até ≈ 60 mm a ΔT 30 K). Prever liras ou mangote flexível junto ao bocal, sem carregar o PRFV.
- **Acessos e plataformas** (projeto CSTR, LAC proposta): V-201SAI e V-202SAI a +7,6 m, potes PS-201/202 com topo a ≈ +6,7 m, LSHH a +8,35 m e ventosas das alças a +5,35/+9,35 m.
- **Tampa de visita M1:** aparafusada e removível, estanque a gás (LAC-029). Não é um cego definitivo.

## R-101 — desenho 315E-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-45 | 150 (6") | tampo az 45°, r = 1000 mm; face a 150 mm do tampo | 4850 | USAR (existente) | respiro de equalização da descida da saída (quebra-sifão, gás) | R-101-RS |  |
| N1-135 | 150 (6") | tampo az 135°, r = 1000 mm; face a 150 mm do tampo | 4850 | USAR (existente) | selo hidráulico de sobre/subpressão (+8/−3 mbar) | SH |  |
| N1-225 | 150 (6") | tampo az 225°, r = 1000 mm; face a 150 mm do tampo | 4850 | USAR (existente) | descarga da ventosa da crista da alça de entrada (gás, quebra-sifão) | R-101-VQ |  |
| N1-315 | 150 (6") | tampo az 315°, r = 1000 mm; face a 150 mm do tampo | 4850 | USAR (existente) | transmissor de nível (radar) | LT |  |
| N2-45 | 150 (6") | costado az 45°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-135 | 150 (6") | costado az 135°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | purga de lodo/esgotamento por bomba (LC + XV falha-fecha, intertravamento por chave com a sucção do tanque; Q ≤ Q_máx RES-001 §5.6) | R-101-PG |  |
| N2-225 | 150 (6") | costado az 225°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | entrada da alimentação pelo fundo (alça externa com ventosa ligada ao gás) | R-101-AL |  |
| N2-315 | 150 (6") | costado az 315°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N3-0 | 50 (2") | tampo az 0°, r = 450 mm; face a 150 mm do tampo | 4850 | USAR (existente) | saída de biogás ao coletor comum | R-101-GAS | posição radial no tampo a conferir no as-built (LAC-043) |
| N3-180 | 50 (2") | tampo az 180°, r = 450 mm; face a 150 mm do tampo | 4850 | USAR (existente) | PT/PSLL/PAHH do espaço de gás | PT | idem LAC-043 |
| M1 | 600 (24") | costado az 90°; eixo a 700 mm do fundo interno | 700 | TAMPONAR (flange cego) | boca de visita inferior: tampa cega estanque a gás (LAC-029) | — |  |
| M2 | 800 (Ø800 mm) | tampo az 0°, r = 1000 mm; face a 170 mm do tampo | 4870 | USAR (existente) | dispositivo de emergência bidirecional | EMG |  |
| A4 | 200 (8") | tampo az 180°, r = 1000 mm; face a 150 mm do tampo | 4850 | CONVERTER: flange 8" + cego | respiro 8" PVC chapéu chinês → flange 8" Classe 150 + flange cego multitomada (abrir só na purga OP-02); candidato ao transbordo dedicado (LAC-038) e às tomadas independentes PSLL/PAHH (LAC-048) | — |  |
| N-SAI | 150 (6") | costado az 90°; eixo a 3576 mm do fundo interno | 3576 | NOVO (furar, laminar e flangear) | saída por gravidade no nível: soleira interna do bocal = N.A. (+3.50); segue ao pote de selagem | R-101-SAI |  |
| N-LSHH | 50 (2") | costado az 65°; eixo a 4350 mm do fundo interno | 4350 | NOVO (furar, laminar e flangear) | chave de nível muito alto (garfo vibratório, sensor dedicado à SIF) | LSHH |  |

## R-201 — desenho 315D-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-45 | 150 (6") | tampo az 45°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | selo hidráulico de sobre/subpressão (+8/−3 mbar) | SH |  |
| N1-135 | 150 (6") | tampo az 135°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | respiro de equalização da descida da saída (quebra-sifão, gás) | R-201-RS |  |
| N1-225 | 150 (6") | tampo az 225°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | descarga da ventosa da crista da alça de entrada (gás, quebra-sifão) | R-201-VQ |  |
| N1-315 | 150 (6") | tampo az 315°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | transmissor de nível (radar) | LT |  |
| N2-45 | 150 (6") | costado az 45°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-135 | 150 (6") | costado az 135°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | purga de lodo/esgotamento por bomba (LC + XV falha-fecha, intertravamento por chave com a sucção do tanque; Q ≤ Q_máx RES-001 §5.6) | R-201-PG |  |
| N2-225 | 150 (6") | costado az 225°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | entrada da alimentação pelo fundo (alça externa com ventosa ligada ao gás) | R-201-AL |  |
| N2-315 | 150 (6") | costado az 315°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N3-0 | 50 (2") | tampo az 0°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | saída de biogás ao coletor comum | R-201-GAS | posição radial no tampo a conferir no as-built (LAC-043) |
| N3-180 | 50 (2") | tampo az 180°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | PT/PSLL/PAHH do espaço de gás | PT | idem LAC-043 |
| M1 | 600 (24") | costado az 90°; eixo a 700 mm do fundo interno | 700 | TAMPONAR (flange cego) | boca de visita inferior: tampa cega estanque a gás (LAC-029) | — |  |
| M2 | 800 (Ø800 mm) | tampo az 0°, r = 1300 mm; face a 170 mm do tampo | 9470 | USAR (existente) | dispositivo de emergência bidirecional | EMG |  |
| A4 | 200 (8") | tampo az 180°, r = 1300 mm; face a 150 mm do tampo | 9450 | CONVERTER: flange 8" + cego | respiro 8" PVC chapéu chinês → flange 8" Classe 150 + flange cego multitomada (abrir só na purga OP-02); candidato ao transbordo dedicado (LAC-038) e às tomadas independentes PSLL/PAHH (LAC-048) | — |  |
| N-SAI | 150 (6") | costado az 146°; eixo a 7576 mm do fundo interno | 7576 | NOVO (furar, laminar e flangear) | saída por gravidade no nível: soleira interna do bocal = N.A. (+7.50); segue ao pote de selagem | R-201-SAI |  |
| N-LSHH | 50 (2") | costado az 110°; eixo a 8350 mm do fundo interno | 8350 | NOVO (furar, laminar e flangear) | chave de nível muito alto (garfo vibratório, sensor dedicado à SIF) | LSHH |  |

## R-202 — desenho 315D-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-45 | 150 (6") | tampo az 45°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | selo hidráulico de sobre/subpressão (+8/−3 mbar) | SH |  |
| N1-135 | 150 (6") | tampo az 135°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | transmissor de nível (radar) | LT |  |
| N1-225 | 150 (6") | tampo az 225°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | respiro de equalização da descida da saída (quebra-sifão, gás) | R-202-RS |  |
| N1-315 | 150 (6") | tampo az 315°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | descarga da ventosa da crista da alça de entrada (gás, quebra-sifão) | R-202-VQ |  |
| N2-45 | 150 (6") | costado az 45°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-135 | 150 (6") | costado az 135°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | purga de lodo/esgotamento por bomba (LC + XV falha-fecha, intertravamento por chave com a sucção do tanque; Q ≤ Q_máx RES-001 §5.6) | R-202-PG |  |
| N2-225 | 150 (6") | costado az 225°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-315 | 150 (6") | costado az 315°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | entrada da alimentação pelo fundo (alça externa com ventosa ligada ao gás) | R-202-AL |  |
| N3-0 | 50 (2") | tampo az 0°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | saída de biogás ao coletor comum | R-202-GAS | posição radial no tampo a conferir no as-built (LAC-043) |
| N3-180 | 50 (2") | tampo az 180°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | PT/PSLL/PAHH do espaço de gás | PT | idem LAC-043 |
| M1 | 600 (24") | costado az 90°; eixo a 700 mm do fundo interno | 700 | TAMPONAR (flange cego) | boca de visita inferior: tampa cega estanque a gás (LAC-029) | — |  |
| M2 | 800 (Ø800 mm) | tampo az 0°, r = 1300 mm; face a 170 mm do tampo | 9470 | USAR (existente) | dispositivo de emergência bidirecional | EMG |  |
| A4 | 200 (8") | tampo az 180°, r = 1300 mm; face a 150 mm do tampo | 9450 | CONVERTER: flange 8" + cego | respiro 8" PVC chapéu chinês → flange 8" Classe 150 + flange cego multitomada (abrir só na purga OP-02); candidato ao transbordo dedicado (LAC-038) e às tomadas independentes PSLL/PAHH (LAC-048) | — |  |
| N-SAI | 150 (6") | costado az 198°; eixo a 7576 mm do fundo interno | 7576 | NOVO (furar, laminar e flangear) | saída por gravidade no nível: soleira interna do bocal = N.A. (+7.50); segue ao pote de selagem | R-202-SAI |  |
| N-LSHH | 50 (2") | costado az 250°; eixo a 8350 mm do fundo interno | 8350 | NOVO (furar, laminar e flangear) | chave de nível muito alto (garfo vibratório, sensor dedicado à SIF) | LSHH |  |

## TQ-201 — desenho novo (CSTR) — LAC-010

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N-ENT | 150 (6") | costado az 270°; eixo a 1936 mm do fundo interno | 2386 | NOVO (furar, laminar e flangear) | entrada do R-101 (descarga livre acima do extravasor) | R-101-TRB |  |
| N-SUC | 100 (4") | costado az 180°; eixo a 250 mm do fundo interno | 700 | NOVO (furar, laminar e flangear) | sucção da P-201 com quebra-vórtice | L-201S | eixo a 250 mm do fundo: Fibrais confirma a distância mínima à junta fundo-costado |
| N-EXT | 150 (6") | costado az 30°; eixo a 1476 mm do fundo interno | 1926 | NOVO (furar, laminar e flangear) | extravasor livre (sem válvula) | L-201EX |  |
| N-DRE | 50 (2") | costado az 135°; eixo a 200 mm do fundo interno | 650 | NOVO (furar, laminar e flangear) | dreno de fundo com registro | L-201DR | idem N-SUC |
| N-LSLL | 50 (2") | costado az 225°; eixo a 470 mm do fundo interno | 920 | NOVO (furar, laminar e flangear) | LSLL garfo (trip P-201) | LSLL |  |
| N-LSHH | 50 (2") | costado az 315°; eixo a 1150 mm do fundo interno | 1600 | NOVO (furar, laminar e flangear) | LSHH garfo (trip P-101) | LSHH |  |
| N-RESP | 150 (6") | tampo az 0°, r = 550 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | respiro ao FCA-201 | L-201RP |  |
| N-AG | 200 (8") | tampo az 0°, r = 0 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | agitador AG-200 | AG-200 |  |
| N-LT | 80 (3") | tampo az 120°, r = 550 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | LT-201 (radar) | LT |  |
| N-PH | 50 (2") | tampo az 180°, r = 550 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | pHIT/ORP-201 (sonda de imersão) | PHIT |  |
| N-DOS | 25 (1") | tampo az 60°, r = 550 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | injeção de NaOH (DOS-201) | DOS |  |
| N-BL | 80 (3") | tampo az 240°, r = 550 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | boia LSL (para a P-201) | LSL |  |
| N-BH | 80 (3") | tampo az 300°, r = 550 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | boia LSH (parte a P-201) | LSH |  |
| N-RL05 | 80 (3") | tampo az 270°, r = 550 mm; face a 150 mm do tampo | 2900 | NOVO (furar, laminar e flangear) | retorno alcalino RL-05 (P-301) | L-RL05 |  |

## TQ-301 — desenho 315A-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-0 | 150 (6") | tampo az 0°, r = 1250 mm; face a 120 mm do tampo | 4660 | USAR (existente) | chegada do R-201 (descarga livre) | R-201-TRB |  |
| N1-90 | 150 (6") | tampo az 90°, r = 1250 mm; face a 120 mm do tampo | 4660 | USAR (existente) | chegada do R-202 (descarga livre) | R-202-TRB |  |
| N1-180 | 150 (6") | tampo az 180°, r = 1250 mm; face a 120 mm do tampo | 4660 | USAR (existente) | LT-301 (radar) | LT |  |
| N1-270 | 150 (6") | tampo az 270°, r = 1250 mm; face a 120 mm do tampo | 4660 | USAR (existente) | retorno da P-301 (recirculação/purga de lodo dos reatores) | L-301R |  |
| N2-0 | 150 (6") | costado az 0°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N2-90 | 150 (6") | costado az 90°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N2-180 | 150 (6") | costado az 180°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N2-270 | 150 (6") | costado az 270°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N3 | 150 (6") | fundo (ponta do cone) | 500 | USAR (existente) | dreno do cone e sucção da P-301 | L-301S |  |
| M1 | 600 (24") | tampo az 0°, r = 0 mm; face a 140 mm do tampo | 4680 | TAMPONAR (flange cego) | boca de visita: tampa cega | — |  |
| N-EXT | 150 (6") | costado az 200°; eixo a 1936 mm da junção cone-costado | 4076 | NOVO (furar, laminar e flangear) | extravasor livre (sem válvula) | L-301EX |  |
| N-LSHH | 50 (2") | costado az 160°; eixo a 1710 mm da junção cone-costado | 3850 | NOVO (furar, laminar e flangear) | LSHH garfo (trip P-201 e purga) | LSHH |  |

## PS-101 — desenho novo (CSTR)

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N-ENT | 150 (6") | tampo az 0°, r = 0 mm; face a 150 mm do tampo | 2990 | NOVO (furar, laminar e flangear) | chegada do reator; continua como tubo mergulhado | R-101-SAI |  |
| N-SAI | 150 (6") | costado az 90°; eixo a 606 mm do fundo interno | 2566 | NOVO (furar, laminar e flangear) | vertedor de saída (lâmina livre) ao destino | R-101-TRB |  |
| N-DRE | 50 (2") | costado az 270°; eixo a 90 mm do fundo interno | 2050 | TAMPONAR (flange cego) | dreno/limpeza do fundo: flange cego removível (abrir só com V-xSAI fechada: chave presa) | — |  |
| N-LAV | 50 (2") | costado az 180°; eixo a 120 mm do fundo interno | 2080 | TAMPONAR (flange cego) | água de lavagem do fundo e da boca do tubo mergulhado: flange cego com engate rápido | — |  |

## PS-201 — desenho novo (CSTR)

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N-ENT | 150 (6") | tampo az 0°, r = 0 mm; face a 150 mm do tampo | 6840 | NOVO (furar, laminar e flangear) | chegada do reator; continua como tubo mergulhado | R-201-SAI |  |
| N-SAI | 150 (6") | costado az 146°; eixo a 606 mm do fundo interno | 6416 | NOVO (furar, laminar e flangear) | vertedor de saída (lâmina livre) ao destino | R-201-TRB |  |
| N-DRE | 50 (2") | costado az 326°; eixo a 90 mm do fundo interno | 5900 | TAMPONAR (flange cego) | dreno/limpeza do fundo: flange cego removível (abrir só com V-xSAI fechada: chave presa) | — |  |
| N-LAV | 50 (2") | costado az 236°; eixo a 120 mm do fundo interno | 5930 | TAMPONAR (flange cego) | água de lavagem do fundo e da boca do tubo mergulhado: flange cego com engate rápido | — |  |

## PS-202 — desenho novo (CSTR)

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N-ENT | 150 (6") | tampo az 0°, r = 0 mm; face a 150 mm do tampo | 6750 | NOVO (furar, laminar e flangear) | chegada do reator; continua como tubo mergulhado | R-202-SAI |  |
| N-SAI | 150 (6") | costado az 198°; eixo a 606 mm do fundo interno | 6326 | NOVO (furar, laminar e flangear) | vertedor de saída (lâmina livre) ao destino | R-202-TRB |  |
| N-DRE | 50 (2") | costado az 18°; eixo a 90 mm do fundo interno | 5810 | TAMPONAR (flange cego) | dreno/limpeza do fundo: flange cego removível (abrir só com V-xSAI fechada: chave presa) | — |  |
| N-LAV | 50 (2") | costado az 288°; eixo a 120 mm do fundo interno | 5840 | TAMPONAR (flange cego) | água de lavagem do fundo e da boca do tubo mergulhado: flange cego com engate rápido | — |  |
