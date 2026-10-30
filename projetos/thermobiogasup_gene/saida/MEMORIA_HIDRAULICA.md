# Memória hidráulica — cascata Gen E com polpa de 8% ST (documento de trabalho)

Situação: **PROPOSTA DE TRABALHO, NÃO LIBERADA.** Revisão 2, depois do Crivo A–F independente (rodada 1 com 3 bloqueantes, tratados aqui). Falta a rodada 2 do Crivo. Cotas na base comum z = 0 (premissa de S5). Sem valores monetários.

## 1. Premissas e método

- **Vazão de projeto das saídas: 6 m³/h.** É a vazão máxima das PCP de alimentação (2–6 m³/h); em regime, o que entra sai. A verificação a 20 m³/h só mostra folga, porque retiradas são bombeadas.
- **Reologia:** plástico de Bingham.
  - Tubo cheio: Buckingham–Reiner e Darby–Mun–Boger.
  - Partida: 4·τy·L/(ρ·g·D).
  - Lâmina livre: sen θ ≥ τy/(ρ·g·0,304·D).
  - **Singulares pelo 2-K de Hooper com o Re de Metzner–Reed** (8ρv²/τw), não com o Re de Bingham. Em polpa com τy cada curva de 90° custa K1·τw/(16ρg): da ordem de 0,5 m com 100 Pa, quase independente do diâmetro.
  - Consequência de projeto: **nenhuma curva cheia nas saídas por gravidade.** Bocal no nível, descidas livres e pote de selagem com tubo mergulhado reto.
- **Três casos de reologia.** São HIPÓTESE até a reometria da polpa real (LAC-041, proposta):

| caso | τy (Pa) | μp (Pa·s) | ρ (kg/m³) |
|---|---|---|---|
| otimista | 5 | 0,02 | 1030 |
| central | 30 | 0,06 | 1030 |
| pessimista | 100 | 0,20 | 1030 |

- **Espaço de gás:** opera de +1,5 a +3,5 mbar. As verificações de nível usam 0 mbar (partida, conservador), e o gráfico usa a operação.
- **NPSH:** P_atm 101.3 kPa (nível do mar; altitude do sítio a definir em S5, lacuna proposta) e P_vapor 5.6 kPa (35 °C).
- **Pote de selagem, virada de 180° no fundo:** modelada como 0.30 m de caminho equivalente no ânulo. É estimativa de engenharia, a confirmar na reometria ou em ensaio de bancada (LAC-041).

## 2. Saídas por gravidade (N-SAI no nível → descida livre → pote de selagem → destino)

Arranjo de cada saída:
- **N-SAI:** bocal novo DN150 com a soleira interna no N.A. de projeto (a mesma cota da tabela de níveis).
- **Descida:** registro LO (faca), depois descida com lâmina livre, com sen θ de 0,31 a 0,50 (mínimo exigido no caso pessimista: 0,23).
- **Pote de selagem:** ao chegar, a descida vira tubo mergulhado DE160 até 330 mm abaixo da soleira do vertedor do pote. O pote transborda por lâmina livre ao destino.
- **Quebra-sifão:** é o próprio bocal no nível. Abaixo da soleira nada escoa por gravidade, e o gás do reator chega pela descida até a superfície interna do pote, que é o fecho hídrico.

Colunas da tabela:
- **Subida na soleira:** lâmina crítica + partida no trecho horizontal + entrada + registro.
- **Carga no pote:** superfície interna menos a soleira do vertedor. Soma a lâmina do vertedor, o tubo mergulhado (atrito + saída) e o ânulo (partida).
- **Folga na soleira:** soleira do N-SAI menos a superfície interna do pote. Se for negativa, o pote afoga a saída e o nível do reator sobe junto.

| reator | caso | Q (m³/h) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) | carga no pote (m) | folga na soleira (m) | sen θ mín. exigido | sen θ adotado | selo (mm / mbar) |
|---|---|---|---|---|---|---|---|---|---|---|
| R-101 | otimista | 6 | 0,06 | 3,56 | 0,64 | 0,06 | 1,05 | 0,012 | 0,50 | 330 / 33 |
| R-201 | otimista | 6 | 0,06 | 7,56 | 0,64 | 0,06 | 1,13 | 0,012 | 0,37 | 330 / 33 |
| R-202 | otimista | 6 | 0,06 | 7,56 | 0,64 | 0,06 | 1,22 | 0,012 | 0,31 | 330 / 33 |
| R-101 | otimista | 20 | 0,10 | 3,60 | 0,60 | 0,10 | 1,01 | 0,012 | 0,50 | 330 / 33 |
| R-201 | otimista | 20 | 0,10 | 7,60 | 0,60 | 0,11 | 1,08 | 0,012 | 0,37 | 330 / 33 |
| R-202 | otimista | 20 | 0,10 | 7,60 | 0,60 | 0,11 | 1,17 | 0,012 | 0,31 | 330 / 33 |
| R-101 | central | 6 | 0,17 | 3,67 | 0,53 | 0,18 | 0,93 | 0,069 | 0,50 | 330 / 33 |
| R-201 | central | 6 | 0,17 | 7,67 | 0,53 | 0,18 | 1,01 | 0,069 | 0,37 | 330 / 33 |
| R-202 | central | 6 | 0,17 | 7,67 | 0,53 | 0,18 | 1,10 | 0,069 | 0,31 | 330 / 33 |
| R-101 | central | 20 | 0,21 | 3,71 | 0,49 | 0,23 | 0,88 | 0,069 | 0,50 | 330 / 33 |
| R-201 | central | 20 | 0,21 | 7,71 | 0,49 | 0,23 | 0,96 | 0,069 | 0,37 | 330 / 33 |
| R-202 | central | 20 | 0,22 | 7,72 | 0,48 | 0,24 | 1,04 | 0,069 | 0,31 | 330 / 33 |
| R-101 | pessimista | 6 | 0,48 | 3,98 | 0,22 | 0,66 | 0,45 | 0,231 | 0,50 | 330 / 33 |
| R-201 | pessimista | 6 | 0,49 | 7,99 | 0,21 | 0,66 | 0,53 | 0,231 | 0,37 | 330 / 33 |
| R-202 | pessimista | 6 | 0,49 | 7,99 | 0,21 | 0,66 | 0,62 | 0,231 | 0,31 | 330 / 33 |
| R-101 | pessimista | 20 | 0,53 | 4,03 | 0,17 | 0,76 | 0,35 | 0,231 | 0,50 | 330 / 33 |
| R-201 | pessimista | 20 | 0,54 | 8,04 | 0,16 | 0,77 | 0,42 | 0,231 | 0,37 | 330 / 33 |
| R-202 | pessimista | 20 | 0,54 | 8,04 | 0,16 | 0,77 | 0,51 | 0,231 | 0,31 | 330 / 33 |

Conclusões das saídas:

1. A saída por gravidade de polpa a 8% ST funciona a 6 m³/h nos três casos de reologia, com este arranjo.
   - Menor folga entre a superfície do pote e a soleira: R-101 0,45 m (pessimista); R-201 0,53 m (pessimista); R-202 0,62 m (pessimista).
   - O nível máximo fica abaixo do LSH em todos os casos.
   - **Divergência do arranjo anterior:** o U de fecho e o standpipe submerso foram abandonados. Com τy alto, as curvas cheias deles faziam o nível passar do LSHH.
2. **Selo de 330 mm de polpa (≈ 33 mbar).** É 2,7× a abertura da emergência (+12 mbar) e 4× o envelope de vácuo dos R-201/202 (−8 mbar). O R-101 tem envelope de −6 mbar e emergência de −4/−5. Também passa os ≥ 250 mm da RES-001 LQ-04.
   - Sob +12 mbar, a superfície interna do pote desce 0,12 m e o tubo mergulhado continua 0,21 m afogado.
   - A proposta citava 500 mmCA: **divergência a validar pelo responsável de processo.**
3. Q = 20 m³/h por gravidade não ocorre, porque as PCP não entregam essa vazão. A linha aparece só como folga.

## 3. Alças de entrada e demais trens bombeados (Q = 6 m³/h)

Funcionamento das alças:
- As alças são pressurizadas, com crista em LSHH + 1,0 m.
- Uma ventosa de esgoto (corpo longo) fica na crista e descarrega no espaço de gás do reator por um N1.
- **Com τy baixo:** a descida perde pouco, a crista fica sob a pressão do gás e a ventosa admite gás (não ar). A descida trabalha livre.
- **Com τy alto:** a PCP pressuriza a descida em DE160 até o N2.
- Em qualquer caso a crista acima do nível impede o sifonamento do reator de volta pela alça.
- A alimentação dos R-201/R-202 é **alternada** pelas V-201AL e V-202BQ atuadas: não há rateio em paralelo.

| trem | caso | perda sucção (m) | perda recalque (m) | AMT (m) | AMT (bar) | pressão na crista (m) | p. sucção no flange (m) | NPSHd (m) |
|---|---|---|---|---|---|---|---|---|
| P-101 → R-101 | otimista | 0,00 | 0,64 | 4,62 | 0,47 | 0,03 | — | — |
| P-201 → R-201 | otimista | 0,16 | 0,91 | 9,27 | 0,94 | 0,03 | 0,06 | 9,53 |
| P-201 → R-202 | otimista | 0,16 | 1,51 | 9,83 | 0,99 | 0,03 | 0,06 | 9,53 |
| P-301 → TQ-301 (recirculação) | otimista | 0,19 | 0,61 | 5,69 | 0,57 | — | 0,56 | 10,03 |
| P-301 → TQ-201 (RL-05) | otimista | 0,19 | 1,19 | 3,67 | 0,37 | — | 0,56 | 10,03 |
| Purga R-201 → P-301 | otimista | 0,41 | 0,61 | -0,42 | -0,04 | — | 6,67 | 16,14 |
| Purga R-101 → P-201 | otimista | 0,36 | 0,91 | 6,86 | 0,69 | 0,03 | 2,48 | 11,95 |
| P-101 → R-101 | central | 0,00 | 3,43 | 6,61 | 0,67 | 0,14 | — | — |
| P-201 → R-201 | central | 0,88 | 4,94 | 13,28 | 1,34 | 0,51 | -0,66 | 8,81 |
| P-201 → R-202 | central | 0,88 | 8,16 | 16,51 | 1,67 | 0,69 | -0,66 | 8,81 |
| P-301 → TQ-301 (recirculação) | central | 1,09 | 3,36 | 9,34 | 0,94 | — | -0,34 | 9,13 |
| P-301 → TQ-201 (RL-05) | central | 1,09 | 6,41 | 9,80 | 0,99 | — | -0,34 | 9,13 |
| Purga R-201 → P-301 | central | 2,38 | 3,36 | 4,30 | 0,43 | — | 4,70 | 14,17 |
| Purga R-101 → P-201 | central | 2,06 | 4,94 | 11,85 | 1,20 | 0,51 | 0,78 | 10,25 |
| P-101 → R-101 | pessimista | 0,00 | 11,36 | 14,54 | 1,47 | 2,70 | — | — |
| P-201 → R-201 | pessimista | 2,92 | 16,39 | 26,78 | 2,71 | 3,91 | -2,70 | 6,77 |
| P-201 → R-202 | pessimista | 2,92 | 27,11 | 37,50 | 3,79 | 4,52 | -2,70 | 6,77 |
| P-301 → TQ-301 (recirculação) | pessimista | 3,63 | 11,16 | 19,68 | 1,99 | — | -2,88 | 6,59 |
| P-301 → TQ-201 (RL-05) | pessimista | 3,63 | 21,29 | 27,23 | 2,75 | — | -2,88 | 6,59 |
| Purga R-201 → P-301 | pessimista | 7,94 | 11,16 | 17,65 | 1,78 | — | -0,85 | 8,62 |
| Purga R-101 → P-201 | pessimista | 6,85 | 16,39 | 28,09 | 2,84 | 3,91 | -4,02 | 5,46 |

Leitura da tabela:

- **Maior AMT:** P-201 → R-202, caso pessimista, com 3,79 bar.
  - Especificar as PCP P-201 e P-301 com ≥ 2 estágios.
  - **PSV (ou disco de ruptura com retorno) e PSHH com trip na descarga, antes de qualquer válvula** (RES-001 VC-10/LQ-01). A PCP fechada contra uma válvula passa da classe do PEAD SDR17.
- **Pressão na crista:** igual à do gás nos casos de τy baixo, quando a ventosa abre; positiva quando a descida é pressurizada.
- **Pressão na sucção:** fica negativa (vácuo de até ≈ 1,4 m) com τy alto, em P-201 e P-301. O NPSH disponível continua ≥ 8 m, o que é adequado para PCP.
  - Nas purgas, a sucção depende do nível do reator: PSL na sucção.
- **Purgas:** registro LC + XV falha-fecha no N2, e chave presa entre V-xPG e a sucção do tanque (V-201S / V-301S). Assim o reator nunca drena por gravidade para o TQ-201/TQ-301.
  - A XV abre só com os permissivos da RES-001 §5.6: PALL, ZSC do gás, LSL do reator, LSHH do destino e PSL da sucção. Ela fecha no trip da bomba.

## 4. TQ-201 (neutralização): Ø1,80 m, fundo a +0,45, sucção a +0,70

| nível | cota (m) | volume (m³) |
|---|---|---|
| LSLL | 0,92 | 1,20 |
| LSL | 1,07 | 1,58 |
| LSH | 1,45 | 2,54 |
| LSHH | 1,60 | 2,93 |
| extravasor | 1,75 | 3,31 |
| entrada | 2,21 | 4,48 |

- **Volume útil** LSL→LSH: 0,97 m³. Detenção até o LSH a 6 m³/h: 25 min (neutralização: 10–30 min usuais).
- **Submergência da sucção (HI 9.8):** o LSLL fica ≥ 0,15 m acima do topo do bocal N-SUC. O pulmão LSH→LSHH é de 3,8 min.
- **Volume que ainda chega depois do trip** (o reator escoa até a soleira, caso otimista), contra o volume LSHH→extravasor:
  - R-101 → TQ-201: 0,48 m³ contra 0,38 m³;
  - R-201 + R-202 → TQ-301: 1,37 m³ contra 1,06 m³.
  - **O extravasor pode operar depois de um trip.** Ele é livre e vai à caixa de contenção (LAC-044), que deve receber esse volume.
  - O LSHH do TQ-201 também corta a P-301 (RL-05).

## 5. Linhas de energia e piezométricas

![LE e LP](LE_LP_gene.png)

- **Lâmina livre:** a LP coincide com a superfície da polpa.
- **No pote:** a LP cai pelo tubo mergulhado e pelo ânulo até o vertedor.
- **Velocidade:** de 0,1 a 0,4 m/s, então v²/2g < 1 cm e a LE se sobrepõe à LP.
- **Bombas:** a LP sobe na bomba (AMT) e cai com o atrito.
- **Alças:** a LP fica no mínimo na crista mais o gás, porque a ventosa admite gás quando cai abaixo disso.

## 6. Lacunas propostas por este cálculo (IDs a confirmar no registro)

- **LAC-041:** reometria da polpa real (τy, μp a 35 °C, 6–9% ST) e ensaio do pote de selagem.
- **LAC-045:** altitude do sítio (NPSH) e confirmação da base comum z = 0 (S5).
- **LAC-046:** selo de 330 mm em vez dos 500 mmCA citados na proposta (decisão do responsável de processo).
