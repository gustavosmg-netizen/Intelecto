# Memória hidráulica — cascata Gen E com polpa de 8% ST (documento de trabalho)

Situação: **PROPOSTA DE TRABALHO, NÃO LIBERADA.** Revisão 4 (coleta no chão, bombas reposicionadas, purgas por gravidade). Precisa passar pelo Crivo A–F independente. Cotas na base comum z = 0 (premissa de S5). Sem valores monetários.

## 1. Premissas e método

- **Vazão de projeto das saídas: 6 m³/h.** É a vazão máxima das PCP de alimentação; em regime, o que entra sai. A linha de 20 m³/h só mostra folga.
- **Reologia:** plástico de Bingham.
  - Tubo cheio: Buckingham–Reiner e Darby–Mun–Boger.
  - Partida: 4·τy·L/(ρ·g·D).
  - Lâmina livre: sen θ ≥ τy/(ρ·g·0,304·D).
  - Singulares pelo 2-K de Hooper com o Re de Metzner–Reed (8ρv²/τw). Com τy alto, uma curva cheia custa ≈ 0,5 m. Por isso **as saídas não têm curvas cheias.**
- **Três casos de reologia** (HIPÓTESE até a reometria da polpa real, LAC-041):

| caso | τy (Pa) | μp (Pa·s) | ρ (kg/m³) |
|---|---|---|---|
| otimista | 5 | 0,02 | 1030 |
| central | 30 | 0,06 | 1030 |
| pessimista | 100 | 0,20 | 1030 |

- **Espaço de gás:** opera de ≈ 0 a +2 mbar, ligado ao gasômetro GH-1 que estiver recebendo (memória de gás). As verificações de nível usam 0 mbar e o gráfico usa +3,5 mbar (envelope de operação, conservador para a LP).
- **NPSH:** P_atm 91,3 kPa (sítio de referência Congonhas/MG, ≈ 870 m; RES-001 §5.5 e LAC-027). P_vapor 5,6 kPa (35 °C).
- **Copo de selagem:** a virada de 180° no fundo foi modelada como 0.30 m de caminho equivalente no ânulo (estimativa a confirmar na LAC-041).

## 2. Saídas por gravidade: reator → copo de selagem interno no tanque do chão

Arranjo de cada saída:
- **N-SAI:** bocal novo DN150 com a soleira interna no N.A., seguido de registro LO (faca) e do tê do respiro de equalização R-xxx-RS, que vai a um N1 do tampo.
- **Descida:** lâmina livre, sen θ ≥ 0,64 (mínimo exigido no caso pessimista: 0,23), até um bocal do tanque de destino **no nível do chão**:
  - R-101 → TQ-201, bocal de costado com curva interna;
  - R-201/R-202 → caixa CS-301, bocais de tampo.
- **Copo de selagem interno** (CP-101, CP-201, CP-202): dentro do tanque novo, a descida continua como tubo mergulhado num copo aberto.
  - A borda do copo fica acima do extravasor do tanque (TQ-201: +1,95 contra +1,85; CS-301: +1,50 contra +1,36). O fecho é a submersão do tubo dentro do copo e não depende do nível do tanque. Se o tanque subir acima da borda, o copo só fica mais afogado.
  - Limpeza: boca de inspeção DN200 sobre o CP-101 (TQ-201). Na CS-301, os copos saem pela tampa aparafusada da caixa.
  - **O fecho de 330 mm não depende do nível do tanque.** O copo é laminado no tanque novo; nenhum tanque existente recebe vertedor.
- **Quebra-sifão:** o respiro RS mantém a descida à pressão do gás mesmo com o N-SAI afogado. Nada abaixo da soleira escoa por gravidade.

| reator | caso | Q (m³/h) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) | carga no copo (m) | folga na soleira (m) | sen θ mín. exigido | sen θ adotado | selo (mm / mbar) |
|---|---|---|---|---|---|---|---|---|---|---|
| R-101 | otimista | 6 | 0,06 | 3,56 | 0,64 | 0,02 | 1,53 | 0,012 | 0,64 | 330 / 33 |
| R-201 | otimista | 6 | 0,06 | 7,56 | 0,64 | 0,02 | 5,98 | 0,012 | 0,71 | 330 / 33 |
| R-202 | otimista | 6 | 0,06 | 7,56 | 0,64 | 0,02 | 5,98 | 0,012 | 0,71 | 330 / 33 |
| R-101 | otimista | 20 | 0,10 | 3,60 | 0,60 | 0,04 | 1,51 | 0,012 | 0,64 | 330 / 33 |
| R-201 | otimista | 20 | 0,10 | 7,60 | 0,60 | 0,04 | 5,96 | 0,012 | 0,71 | 330 / 33 |
| R-202 | otimista | 20 | 0,10 | 7,60 | 0,60 | 0,04 | 5,96 | 0,012 | 0,71 | 330 / 33 |
| R-101 | central | 6 | 0,19 | 3,69 | 0,51 | 0,08 | 1,47 | 0,069 | 0,64 | 330 / 33 |
| R-201 | central | 6 | 0,19 | 7,69 | 0,51 | 0,08 | 5,92 | 0,069 | 0,71 | 330 / 33 |
| R-202 | central | 6 | 0,19 | 7,69 | 0,51 | 0,08 | 5,92 | 0,069 | 0,71 | 330 / 33 |
| R-101 | central | 20 | 0,23 | 3,73 | 0,47 | 0,11 | 1,44 | 0,069 | 0,64 | 330 / 33 |
| R-201 | central | 20 | 0,23 | 7,73 | 0,47 | 0,11 | 5,89 | 0,069 | 0,71 | 330 / 33 |
| R-202 | central | 20 | 0,23 | 7,73 | 0,47 | 0,11 | 5,89 | 0,069 | 0,71 | 330 / 33 |
| R-101 | pessimista | 6 | 0,53 | 4,03 | 0,17 | 0,33 | 1,22 | 0,231 | 0,64 | 330 / 33 |
| R-201 | pessimista | 6 | 0,53 | 8,03 | 0,17 | 0,33 | 5,67 | 0,231 | 0,71 | 330 / 33 |
| R-202 | pessimista | 6 | 0,53 | 8,03 | 0,17 | 0,33 | 5,67 | 0,231 | 0,71 | 330 / 33 |
| R-101 | pessimista | 20 | 0,59 | 4,09 | 0,11 | 0,38 | 1,17 | 0,231 | 0,64 | 330 / 33 |
| R-201 | pessimista | 20 | 0,59 | 8,09 | 0,11 | 0,38 | 5,62 | 0,231 | 0,71 | 330 / 33 |
| R-202 | pessimista | 20 | 0,59 | 8,09 | 0,11 | 0,38 | 5,62 | 0,231 | 0,71 | 330 / 33 |

Conclusões:

1. A saída por gravidade funciona a 6 m³/h nos três casos, com folga grande entre a superfície no copo e a soleira do reator: R-101 1,22 m; R-201 5,67 m; R-202 5,67 m.
   - Na revisão 3, com potes elevados, essa folga era de 0,35 a 0,6 m.
   - O limite passa a ser só a subida do nível sobre a soleira do N-SAI (até 0,53 m no caso pessimista), coberta pelo LSH.
2. **Selo de 330 mm (≈ 33 mbar)** contra emergência de +12 mbar e envelope de −8 mbar (R-101: −6). A LAC-046 registra a divergência dos 500 mmCA da proposta.
3. **O biogás arrastado pelos copos vai aos tanques do chão.** TQ-201 e CS-301 têm respiro tratado (FCA-201, FCA-301). O interior do TQ-201 vira zona classificada e o AG-200 precisa ser ATEX; ver LAC-049.

## 3. Purgas: só por bomba volumétrica, com reposição de gás

Por gravidade, com a carga do reator (≈ 6,4 m), a purga dos R-201/202 passaria de 100 m³/h com a válvula aberta. Isso fica muito acima do Q_máx de 20 m³/h, que a RES-001 §5.6 exige limitado fisicamente. Orifício não serve para polpa: com 17 mm entope. Por isso:

- **R-201/R-202 → P-302 → CS-301.** A P-302 é uma PCP dedicada às purgas. A vazão fica limitada pelo deslocamento da bomba (≤ 6 m³/h), com descarga livre no tampo da CS-301.
  - Barreiras: LC + XV falha-fecha no N2 (abre só com a bomba em marcha, fecha com ela) e chave presa única V-201PG × V-202PG (um reator por vez).
  - A PCP parada e a XV fechada são dois elementos independentes contra o escoamento por gravidade.
  - Com τy baixo a AMT da P-302 fica negativa (tabela da seção 4): a carga do reator empurra e a PCP trabalha como **freio volumétrico**.
  - Especificar inversor com frenagem e PCP de 2 estágios, para conter a carga do reator com escorregamento baixo.
  - O FIT confere a vazão real. Se ela passar do comando, a XV fecha.
- **R-101 → P-201 → TQ-201.** A P-201 aspira o R-101 pela purga, com chave presa com a V-201S, e descarrega pela recirculação L-201RC no TQ-201, que neutraliza o lodo ácido antes de qualquer alimentação dos metanogênicos.
- **Reposição de gás:** o reator só perde volume ligado à bolsa GH-1 que recebe (V-xGAS aberta, ZSO; bolsa ≥ 70%). A 6 m³/h a reposição pelo ramal custa centésimos de mbar.
- **Lavagem:** engates de água nas linhas de purga, que ficam cheias de polpa parada.

## 4. Trens bombeados (Q = 6 m³/h)

Bombas e localização:
- **P-201**, junto ao TQ-201: sucção reta, sem curvas. Alimenta R-201/R-202 alternadamente pelas alças pressurizadas com ventosa ligada ao gás.
- **P-302** (purgas), junto à CS-301, em poço raso de 0,15 m para a sucção ficar na cota dos N2.
- **Reserva:** bomba PCP móvel sobre skid, com engate na CS-301 (N-BYP) e mobilização ≤ 30 min, para P-301 e P-302. Estatores sobressalentes em almoxarifado.
  - A CS-301 tem ≈ 6 min entre LSL e LSH a 6 m³/h. Se a P-301 falhar, o LSHH corta a P-201 e a alimentação para, sem extravasar.
  - Recirculação ou expedição pelo N3 do TQ-301 só com a alimentação dos metanogênicos parada (a V-301S fica fechada por chave).
- **P-301**, junto à CS-301 no chão: sucção curta e reta.
  - Transfere o digestato ao TQ-301 (armazenamento), faz o retorno alcalino RL-05 e a expedição. O RL-05 tem XV com FIT e fecha no LSHH do TQ-201 sem parar a transferência.
  - Por chave presa, aspira o TQ-301 pelo N3 para recirculação ou expedição.
  - By-pass por engate rápido de bomba móvel na CS-301.

| trem | caso | perda sucção (m) | perda recalque (m) | AMT (m) | AMT (bar) | pressão na crista (m) | p. sucção no flange (m) | NPSHd (m) |
|---|---|---|---|---|---|---|---|---|
| P-101 → R-101 | otimista | 0,00 | 0,64 | 4,62 | 0,47 | 0,03 | — | — |
| P-201 → R-201 | otimista | 0,06 | 0,87 | 9,13 | 0,92 | 0,03 | 0,16 | 8,64 |
| P-201 → R-202 | otimista | 0,06 | 1,47 | 9,69 | 0,98 | 0,03 | 0,16 | 8,64 |
| P-301 → TQ-301 (transferência) | otimista | 0,03 | 0,54 | 5,72 | 0,58 | — | 0,22 | 8,70 |
| P-301 → TQ-201 (RL-05) | otimista | 0,03 | 1,23 | 4,07 | 0,41 | — | 0,22 | 8,70 |
| P-301 ← TQ-301 (recirculação/expedição) | otimista | 0,28 | 0,54 | 5,46 | 0,55 | — | 0,47 | 8,96 |
| Purga R-101 → P-201 → TQ-201 | otimista | 0,32 | 0,59 | 1,22 | 0,12 | — | 1,98 | 10,46 |
| Purga R-201 → P-302 → CS-301 | otimista | 0,16 | 0,38 | -4,06 | -0,41 | — | 6,54 | 15,02 |
| Purga R-202 → P-302 → CS-301 | otimista | 0,32 | 0,38 | -3,90 | -0,39 | — | 6,38 | 14,86 |
| P-101 → R-101 | central | 0,00 | 3,43 | 6,61 | 0,67 | 0,14 | — | — |
| P-201 → R-201 | central | 0,34 | 4,70 | 12,51 | 1,26 | 0,51 | -0,12 | 8,36 |
| P-201 → R-202 | central | 0,34 | 7,93 | 15,73 | 1,59 | 0,69 | -0,12 | 8,36 |
| P-301 → TQ-301 (transferência) | central | 0,19 | 3,00 | 8,32 | 0,84 | — | 0,06 | 8,54 |
| P-301 → TQ-201 (RL-05) | central | 0,19 | 6,68 | 9,67 | 0,98 | — | 0,06 | 8,54 |
| P-301 ← TQ-301 (recirculação/expedição) | central | 1,60 | 3,00 | 9,23 | 0,93 | — | -0,85 | 7,64 |
| Purga R-101 → P-201 → TQ-201 | central | 1,86 | 3,11 | 5,27 | 0,53 | — | 0,44 | 8,92 |
| Purga R-201 → P-302 → CS-301 | central | 0,91 | 2,07 | -1,62 | -0,16 | — | 5,79 | 14,27 |
| Purga R-202 → P-302 → CS-301 | central | 1,87 | 2,07 | -0,66 | -0,07 | — | 4,83 | 13,31 |
| P-101 → R-101 | pessimista | 0,00 | 11,36 | 14,54 | 1,47 | 2,70 | — | — |
| P-201 → R-201 | pessimista | 1,14 | 15,59 | 24,20 | 2,45 | 3,91 | -0,92 | 7,56 |
| P-201 → R-202 | pessimista | 1,14 | 26,32 | 34,92 | 3,53 | 4,52 | -0,92 | 7,56 |
| P-301 → TQ-301 (transferência) | pessimista | 0,62 | 9,95 | 15,71 | 1,59 | — | -0,37 | 8,11 |
| P-301 → TQ-201 (RL-05) | pessimista | 0,62 | 22,20 | 25,62 | 2,59 | — | -0,37 | 8,11 |
| P-301 ← TQ-301 (recirculação/expedição) | pessimista | 5,31 | 9,95 | 19,91 | 2,01 | — | -4,56 | 3,92 |
| Purga R-101 → P-201 → TQ-201 | pessimista | 6,19 | 10,29 | 16,77 | 1,69 | — | -3,89 | 4,60 |
| Purga R-201 → P-302 → CS-301 | pessimista | 3,04 | 6,87 | 5,32 | 0,54 | — | 3,66 | 12,14 |
| Purga R-202 → P-302 → CS-301 | pessimista | 6,24 | 6,87 | 8,51 | 0,86 | — | 0,46 | 8,94 |

Leitura da tabela:

- **Maior AMT:** P-201 → R-202 (pessimista), 3,53 bar.
  - PCP de ≥ 2 estágios.
  - PSV ou disco de ruptura com retorno ao tanque de origem e PSHH com trip na descarga, antes de qualquer válvula.
- **Pior pressão de sucção:** -4,56 m (P-301 ← TQ-301 (recirculação/expedição), pessimista). **Menor NPSHd:** 3,92 m.
  - PCP com NPSHr ≤ 3 m.
  - Sucção soldada e selo com flush, porque vácuo na sucção admite ar.
- **Purgas:** ver seção 3.

## 5. TQ-201 (neutralização) e CS-301 (coleta do digestato)

| TQ-201: nível | cota (m) | volume (m³) |
|---|---|---|
| LSLL | 0,92 | 1,20 |
| LSL | 1,07 | 1,58 |
| LSH | 1,45 | 2,54 |
| LSHH | 1,60 | 2,93 |
| extravasor | 1,85 | 3,56 |
| entrada | 2,47 | 5,14 |
| copo | 1,95 | 3,82 |

- **TQ-201:** volume útil LSL→LSH 0,97 m³. Detenção até o LSH a 6 m³/h: 25 min.
- **CS-301:** Ø2,0 m, fundo a +0,15 e tampa estanque com respiro ao FCA-301.
  - Níveis: LSLL +0,70, LSL +0,80, LSH +1,00, LSHH +1,10, extravasor +1,36, borda dos copos +1,50.
  - A P-301 trabalha com inversor, controlada pelo LT da CS-301.
- **Volume que ainda chega depois de um corte da alimentação** (caso otimista, o pior), contra o volume entre LSHH e extravasor:
  - R-101 → TQ-201: 0,51 contra 0,64 m³;
  - R-201 ou R-202 → CS-301 (um por vez): 0,71 contra 0,82 m³.
  - Mesmo com a P-301 parada, nenhum dos dois extravasa num corte normal.
  - O volume vale para um metanogênico por vez. A alternância R-201/R-202 deve durar mais que o esvaziamento até a soleira (dezenas de minutos); se os dois escoarem juntos, são ≈ 1,4 m³ e o excedente vai ao extravasor e à contenção (LAC-044).

## 6. Linhas de energia e piezométricas

![LE e LP](LE_LP_gene.png)

- **Lâmina livre:** a LP é a superfície da polpa.
- **No copo:** a LP cai pelo tubo mergulhado e pelo ânulo até a borda; depois a polpa cai livre no tanque.
- **Velocidade:** v²/2g < 1 cm, então a LE se sobrepõe à LP.
- **Bombas:** a LP sobe na bomba (AMT) e cai com o atrito.

## 7. Lacunas

Ver `LACUNAS_PROPOSTAS.md`. As que decidem este cálculo:
- LAC-041: reometria e ensaio do copo.
- LAC-027/045: sítio e base z = 0.
- LAC-046: selo de 330 mm.
- LAC-049: biogás nos respiros.
