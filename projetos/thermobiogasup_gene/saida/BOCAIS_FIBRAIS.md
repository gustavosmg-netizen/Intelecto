# Lista de bocais De→Para — reatores e tanques PRFV (Gen E)

Situação: **DOCUMENTO DE TRABALHO — não liberado para emissão.** Revisão 5 (planta enxuta: sem tanque de neutralização, alimentação pelo tampo), revisada pelo Crivo A–F independente e corrigida. **Não furar antes de fechar a LAC-006** (arranjo de bocais e saída nivelada, FEA da modificação) **e a LAC-031** (envelope garantido). Estanqueidade a gás de M1/A4/flanges cegos: LAC-029.

Convenções:
- Flanges com furação ASME B16.5 Classe 150, face plana (FF) no PRFV. Válvulas FF e junta full-face.
- Azimute horário a partir do 0° do desenho Fibrais, que deve coincidir com o norte de projeto na montagem.
- Cotas absolutas na base comum z = 0 (premissa de S5). Uso: alinhar com a Fibrais o que é aberto, novo e tamponado.

Legenda: **NOVO** = furar, laminar o pescoço com reforço (repad) e flangear. **TAMPONAR** = flange cego estanque a gás, com junta e parafusos. **CONVERTER** = adaptar o bocal para receber flange e cego.

## Resumo para a Fibrais

| equipamento | bocais novos (qtd × DN) | flanges cegos (qtd × DN) |
|---|---|---|
| R-101 | 1× DN50 | 4× DN150 + 1× DN200 + 1× DN600 |
| R-201 | 1× DN50 + 1× DN150 | 3× DN150 + 1× DN200 + 1× DN600 |
| R-202 | 1× DN50 + 1× DN150 | 3× DN150 + 1× DN200 + 1× DN600 |
| TQ-301 | 1× DN50 + 1× DN150 | 6× DN150 + 1× DN600 |
| CS-301 | 5× DN50 + 1× DN80 + 1× DN100 + 4× DN150 | 1× DN100 |
| **total nos tanques Fibrais existentes** | **4× DN50 + 3× DN150** | **16× DN150 + 3× DN200 + 4× DN600** |

Leitura do resumo:
- **Reatores (já fabricados):** os bocais novos são só a saída N-SAI DN150, com a soleira interna no N.A. (+3,50 / +7,50), e o LSHH DN50.
- **TQ-301 (já fabricado):** passa a ser só armazenamento do digestato. Recebe pela P-301 no N1-270; N1-0 e N1-90 ficam cegos; novos só o extravasor e o LSHH.
- **Reatores, flanges cegos:** dois N2, o M1 e o A4. Os quatro N1 ficam em uso: alimentação, respiro de equalização da saída (R-201/202), selo hidráulico e radar; no R-101 sobra um N1 cego de reserva.
- **A4 (8"):** é convertido em flange com cego multitomada. É o candidato ao transbordo dedicado (LAC-038) e às tomadas independentes de PSLL/PAHH (LAC-048).
- **R-101:** sem saída por transbordo na rev. 5; o único bocal novo é o LSHH. A retirada sai pelo N2-135 (fundo) à P-201.
- **Alimentação de todos os reatores pelo tampo (N1)** com tubo de imersão interno e furo quebra-sifão. A Fibrais precisa confirmar a carga no tampo e a folga para o misturador (LAC-047). Se não for possível, a alternativa é descarregar direto no N1, sem tubo: ver ESTUDO_ALTERNATIVAS.
- **CS-301 (nova, especificação CSTR):** todos os bocais são novos e leva copos de selagem internos laminados (CP-201 e CP-202 na CS-301). Não entram no total dos tanques existentes.

## O que a Fibrais precisa confirmar ou fornecer antes de furar

- **Cargas nos bocais novos.** A N-SAI recebe só o registro e o tê do respiro. A descida até o tanque do chão se apoia numa estrutura metálica a projetar (LAC-047), não no bocal. A Fibrais informa as cargas admissíveis (forças e momentos) e o reforço (repad) de cada abertura nova, com a FEA da LAC-006.
- **Tubos de imersão no N1:** carga no tampo (≈ 30–60 kg cheios), fixação no flange, folga para pás e chicanas do misturador (SP-12).
- **Detalhes internos da CS-301 (nova):** copos de selagem CP-201/202 com borda acima do nível máximo, sondas de pH/ORP nos copos e quebra-vórtice no N-SUC.
- **Dilatação do PEAD** entre o piso e os bocais altos (até ≈ 60 mm a ΔT 30 K). Prever liras ou mangote flexível junto ao bocal, sem carregar o PRFV.
- **Acessos e plataformas** (projeto CSTR, LAC proposta): V-201SAI e V-202SAI a +7,6 m, LSHH a +8,35 m e válvulas de entrada no tampo (+4,85/+9,45). As caixas e bombas ficam no chão.
- **Tampa de visita M1:** aparafusada e removível, estanque a gás (LAC-029). Não é um cego definitivo.

## R-101 — desenho 315E-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-45 | 150 (6") | tampo az 45°, r = 1000 mm; face a 150 mm do tampo | 4850 | TAMPONAR (flange cego) | reserva: transbordo dedicado (LAC-038) ou tomada independente PSLL/PAHH (RES-001 §5.6) | — |  |
| N1-135 | 150 (6") | tampo az 135°, r = 1000 mm; face a 150 mm do tampo | 4850 | USAR (existente) | selo hidráulico de sobre/subpressão (+8/−3 mbar) | SH |  |
| N1-225 | 150 (6") | tampo az 225°, r = 1000 mm; face a 150 mm do tampo | 4850 | USAR (existente) | alimentação pelo tampo (tubo de imersão nos R-201/202; descarga direta no R-101) | R-101-AL |  |
| N1-315 | 150 (6") | tampo az 315°, r = 1000 mm; face a 150 mm do tampo | 4850 | USAR (existente) | transmissor de nível (radar) | LT |  |
| N2-45 | 150 (6") | costado az 45°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-135 | 150 (6") | costado az 135°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | retirada pelo fundo à P-201 (bomba volumétrica; LC + XV falha-fecha; só com o reator ligado à bolsa GH-1 que recebe) | L-101S |  |
| N2-225 | 150 (6") | costado az 225°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-315 | 150 (6") | costado az 315°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N3-0 | 50 (2") | tampo az 0°, r = 450 mm; face a 150 mm do tampo | 4850 | USAR (existente) | saída de biogás ao coletor comum | R-101-GAS | posição radial no tampo a conferir no as-built (LAC-043) |
| N3-180 | 50 (2") | tampo az 180°, r = 450 mm; face a 150 mm do tampo | 4850 | USAR (existente) | PT/PSLL/PAHH do espaço de gás | PT | idem LAC-043 |
| M1 | 600 (24") | costado az 90°; eixo a 700 mm do fundo interno | 700 | TAMPONAR (flange cego) | boca de visita inferior: tampa cega estanque a gás (LAC-029) | — |  |
| M2 | 800 (Ø800 mm) | tampo az 0°, r = 1000 mm; face a 170 mm do tampo | 4870 | USAR (existente) | dispositivo de emergência bidirecional | EMG |  |
| A4 | 200 (8") | tampo az 180°, r = 1000 mm; face a 150 mm do tampo | 4850 | CONVERTER: flange 8" + cego | respiro 8" PVC chapéu chinês → flange 8" Classe 150 + flange cego multitomada (abrir só na purga OP-02); tomadas independentes PSLL/PAHH (LAC-048) | — |  |
| N-LSHH | 50 (2") | costado az 65°; eixo a 4350 mm do fundo interno | 4350 | NOVO (furar, laminar e flangear) | chave de nível muito alto (garfo vibratório, sensor dedicado à SIF) | LSHH |  |

## R-201 — desenho 315D-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-45 | 150 (6") | tampo az 45°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | selo hidráulico de sobre/subpressão (+8/−3 mbar) | SH |  |
| N1-135 | 150 (6") | tampo az 135°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | alimentação pelo tampo (tubo de imersão nos R-201/202; descarga direta no R-101) | R-201-AL | tubo de imersão interno DN150 até +6.10, furo quebra-sifão a +9.05 |
| N1-225 | 150 (6") | tampo az 225°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | respiro de equalização da descida da saída (quebra-sifão, gás) | R-201-RS |  |
| N1-315 | 150 (6") | tampo az 315°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | transmissor de nível (radar) | LT |  |
| N2-45 | 150 (6") | costado az 45°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-135 | 150 (6") | costado az 135°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | purga de lodo pela P-301 (manifold com chave presa; LC + XV falha-fecha; vazão ≤ deslocamento da bomba ≪ Q_máx) | R-201-PG |  |
| N2-225 | 150 (6") | costado az 225°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-315 | 150 (6") | costado az 315°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N3-0 | 50 (2") | tampo az 0°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | saída de biogás ao coletor comum | R-201-GAS | posição radial no tampo a conferir no as-built (LAC-043) |
| N3-180 | 50 (2") | tampo az 180°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | PT/PSLL/PAHH do espaço de gás | PT | idem LAC-043 |
| M1 | 600 (24") | costado az 90°; eixo a 700 mm do fundo interno | 700 | TAMPONAR (flange cego) | boca de visita inferior: tampa cega estanque a gás (LAC-029) | — |  |
| M2 | 800 (Ø800 mm) | tampo az 0°, r = 1300 mm; face a 170 mm do tampo | 9470 | USAR (existente) | dispositivo de emergência bidirecional | EMG |  |
| A4 | 200 (8") | tampo az 180°, r = 1300 mm; face a 150 mm do tampo | 9450 | CONVERTER: flange 8" + cego | respiro 8" PVC chapéu chinês → flange 8" Classe 150 + flange cego multitomada (abrir só na purga OP-02); tomadas independentes PSLL/PAHH (LAC-048) | — |  |
| N-SAI | 150 (6") | costado az 182°; eixo a 7576 mm do fundo interno | 7576 | NOVO (furar, laminar e flangear) | saída por gravidade no nível: soleira interna do bocal = N.A. (+7.50); segue ao copo de selagem no tanque do chão | R-201-SAI |  |
| N-LSHH | 50 (2") | costado az 110°; eixo a 8350 mm do fundo interno | 8350 | NOVO (furar, laminar e flangear) | chave de nível muito alto (garfo vibratório, sensor dedicado à SIF) | LSHH |  |

## R-202 — desenho 315D-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-45 | 150 (6") | tampo az 45°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | selo hidráulico de sobre/subpressão (+8/−3 mbar) | SH |  |
| N1-135 | 150 (6") | tampo az 135°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | alimentação pelo tampo (tubo de imersão nos R-201/202; descarga direta no R-101) | R-202-AL | tubo de imersão interno DN150 até +6.10, furo quebra-sifão a +9.05 |
| N1-225 | 150 (6") | tampo az 225°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | respiro de equalização da descida da saída (quebra-sifão, gás) | R-202-RS |  |
| N1-315 | 150 (6") | tampo az 315°, r = 1300 mm; face a 150 mm do tampo | 9450 | USAR (existente) | transmissor de nível (radar) | LT |  |
| N2-45 | 150 (6") | costado az 45°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-135 | 150 (6") | costado az 135°; eixo a 300 mm do fundo interno | 300 | USAR (existente) | purga de lodo pela P-301 (manifold com chave presa; LC + XV falha-fecha; vazão ≤ deslocamento da bomba ≪ Q_máx) | R-202-PG |  |
| N2-225 | 150 (6") | costado az 225°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N2-315 | 150 (6") | costado az 315°; eixo a 300 mm do fundo interno | 300 | TAMPONAR (flange cego) | sem uso: flange cego PRFV (reduz caminhos de esvaziamento, VC-05) | — |  |
| N3-0 | 50 (2") | tampo az 0°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | saída de biogás ao coletor comum | R-202-GAS | posição radial no tampo a conferir no as-built (LAC-043) |
| N3-180 | 50 (2") | tampo az 180°, r = 450 mm; face a 150 mm do tampo | 9450 | USAR (existente) | PT/PSLL/PAHH do espaço de gás | PT | idem LAC-043 |
| M1 | 600 (24") | costado az 90°; eixo a 700 mm do fundo interno | 700 | TAMPONAR (flange cego) | boca de visita inferior: tampa cega estanque a gás (LAC-029) | — |  |
| M2 | 800 (Ø800 mm) | tampo az 0°, r = 1300 mm; face a 170 mm do tampo | 9470 | USAR (existente) | dispositivo de emergência bidirecional | EMG |  |
| A4 | 200 (8") | tampo az 180°, r = 1300 mm; face a 150 mm do tampo | 9450 | CONVERTER: flange 8" + cego | respiro 8" PVC chapéu chinês → flange 8" Classe 150 + flange cego multitomada (abrir só na purga OP-02); tomadas independentes PSLL/PAHH (LAC-048) | — |  |
| N-SAI | 150 (6") | costado az 230°; eixo a 7576 mm do fundo interno | 7576 | NOVO (furar, laminar e flangear) | saída por gravidade no nível: soleira interna do bocal = N.A. (+7.50); segue ao copo de selagem no tanque do chão | R-202-SAI |  |
| N-LSHH | 50 (2") | costado az 250°; eixo a 8350 mm do fundo interno | 8350 | NOVO (furar, laminar e flangear) | chave de nível muito alto (garfo vibratório, sensor dedicado à SIF) | LSHH |  |

## TQ-301 — desenho 315A-25

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N1-0 | 150 (6") | tampo az 0°, r = 1250 mm; face a 120 mm do tampo | 4660 | TAMPONAR (flange cego) | sem uso: flange cego (reserva para respiro tratado, LAC-049) | — |  |
| N1-90 | 150 (6") | tampo az 90°, r = 1250 mm; face a 120 mm do tampo | 4660 | TAMPONAR (flange cego) | sem uso: flange cego | — |  |
| N1-180 | 150 (6") | tampo az 180°, r = 1250 mm; face a 120 mm do tampo | 4660 | USAR (existente) | LT-301 (radar) | LT |  |
| N1-270 | 150 (6") | tampo az 270°, r = 1250 mm; face a 120 mm do tampo | 4660 | USAR (existente) | chegada do digestato pela P-301 (descarga livre) | L-301R |  |
| N2-0 | 150 (6") | costado az 0°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N2-90 | 150 (6") | costado az 90°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N2-180 | 150 (6") | costado az 180°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N2-270 | 150 (6") | costado az 270°; eixo a 340 mm da junção cone-costado | 2480 | TAMPONAR (flange cego) | sem uso: flange cego PRFV | — |  |
| N3 | 150 (6") | fundo (ponta do cone) | 500 | USAR (existente) | dreno do cone; sucção alternativa da P-301 (recirculação/expedição) | L-301N3 |  |
| M1 | 600 (24") | tampo az 0°, r = 0 mm; face a 140 mm do tampo | 4680 | TAMPONAR (flange cego) | boca de visita: tampa cega | — |  |
| N-EXT | 150 (6") | costado az 200°; eixo a 1936 mm da junção cone-costado | 4076 | NOVO (furar, laminar e flangear) | extravasor livre (sem válvula) | L-301EX |  |
| N-LSHH | 50 (2") | costado az 160°; eixo a 1710 mm da junção cone-costado | 3850 | NOVO (furar, laminar e flangear) | LSHH garfo (trip da P-301) | LSHH |  |

## CS-301 — desenho novo (CSTR)

| bocal | DN | posição | z abs. (mm) | ação | serviço | ligado a | nota |
|---|---|---|---|---|---|---|---|
| N-E201 | 150 (6") | tampo az 308°, r = 570 mm; face a 150 mm do tampo | 1950 | NOVO (furar, laminar e flangear) | chegada do R-201: tubo mergulhado do copo CP-201 | R-201-SAI |  |
| N-E202 | 150 (6") | tampo az 52°, r = 570 mm; face a 150 mm do tampo | 1950 | NOVO (furar, laminar e flangear) | chegada do R-202: tubo mergulhado do copo CP-202 | R-202-SAI |  |
| N-SUC | 150 (6") | costado az 270°; eixo a 300 mm do fundo interno | 450 | NOVO (furar, laminar e flangear) | sucção da P-301 (quebra-vórtice) | L-301S |  |
| N-EXT | 150 (6") | costado az 180°; eixo a 1286 mm do fundo interno | 1436 | NOVO (furar, laminar e flangear) | extravasor livre à contenção | L-CS301EX |  |
| N-DRE | 50 (2") | costado az 200°; eixo a 100 mm do fundo interno | 250 | NOVO (furar, laminar e flangear) | dreno de fundo com registro | L-CS301DR |  |
| N-BYP | 100 (4") | costado az 160°; eixo a 300 mm do fundo interno | 450 | TAMPONAR (flange cego) | by-pass da P-301: engate rápido para bomba móvel (cego com engate) | — |  |
| N-LT | 80 (3") | tampo az 180°, r = 600 mm; face a 150 mm do tampo | 1950 | NOVO (furar, laminar e flangear) | LT-301C (radar) | LT |  |
| N-RESP | 100 (4") | tampo az 270°, r = 600 mm; face a 150 mm do tampo | 1950 | NOVO (furar, laminar e flangear) | respiro ao FCA-301 | L-CS301RP |  |
| N-LSLL | 50 (2") | costado az 240°; eixo a 550 mm do fundo interno | 700 | NOVO (furar, laminar e flangear) | LSLL garfo (trip da P-301) | LSLL |  |
| N-LSHH | 50 (2") | costado az 120°; eixo a 950 mm do fundo interno | 1100 | NOVO (furar, laminar e flangear) | LSHH garfo (trip P-201 e purgas) | LSHH |  |
| N-AT201 | 50 (2") | tampo az 322°, r = 730 mm; face a 150 mm do tampo | 1950 | NOVO (furar, laminar e flangear) | pH/ORP da saída do R-201 (sonda no copo CP-201) | AIT |  |
| N-AT202 | 50 (2") | tampo az 38°, r = 730 mm; face a 150 mm do tampo | 1950 | NOVO (furar, laminar e flangear) | pH/ORP da saída do R-202 (sonda no copo CP-202) | AIT |  |
