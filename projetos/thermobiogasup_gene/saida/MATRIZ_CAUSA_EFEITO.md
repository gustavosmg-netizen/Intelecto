# Matriz de causa e efeito e monitoramento — Gen E rev. 4 (documento de trabalho)

Base: RES-001 §5.6 e as regras do cliente (retiradas só por linha exclusiva, com anti-retorno e a fonte em recebimento). Os ajustes são propostas, a confirmar no HAZOP/LOPA. As SIF exigem sensores independentes dos de controle (LAC-048).

| iniciador | ajuste | ação | tipo |
|---|---|---|---|
| LSHH de reator (R-101/201/202) | +4,35 / +8,35 m | Para a alimentação daquele reator (P-101 ou P-201, com a XV de alternância); alarme | SIF / hardwired |
| LSH de reator | +4,20 / +8,20 m | Alarme (saída obstruída?) | alarme |
| PAH / PAHH do reator | +5 / +6 mbar | PAHH: para a alimentação; parte S-501B e abre a XV-FL; último recurso: alívio conduzido do GH-1 | SIF a definir no HAZOP |
| PALL do reator | 0 mbar | Fecha as XV de purga, para P-201 (purga do R-101), P-302 e o S-501, e fecha as saídas dos GH-1 | hardwired |
| ZSC da V-xSAI / V-xRS ou da V-xGAS fechada | — | Bloqueia a alimentação do reator (saída ou gás isolados) | permissivo |
| LSLL do TQ-201 | +0,92 m | Para a P-201 | SIF |
| LSHH do TQ-201 | +1,60 m | Para a P-101 e fecha a XV-RL05 | hardwired |
| LSLL da CS-301 | +0,70 m | Para a P-301 | hardwired |
| LSHH da CS-301 | +1,10 m | Para a P-201 e a P-302 e fecha as XV de purga | hardwired |
| LSHH do TQ-301 | +3,85 m | Para a P-301 na transferência (a CS-301 sobe até o LSHH e corta a P-201) | hardwired |
| PSHH na descarga das PCP | abaixo da classe do PEAD | Trip da bomba (a PSV alivia antes de qualquer válvula) | hardwired |
| PSL na sucção das PCP | — | Trip da bomba (marcha a seco) | hardwired |
| Permissivo de purga (P-302, P-201) | — | V-xGAS aberta (ZSO), bolsa que recebe ≥ 70%, destino < LSH, nenhuma outra retirada; a XV abre só com a bomba em marcha e fecha com ela | permissivo |
| Permissivo de entrada de uma bolsa GH-1 | — | Saída da mesma bolsa fechada (ZSC) e S-501 parado | intertravamento |
| Permissivo de saída de uma bolsa GH-1 | — | Entrada da mesma bolsa fechada (ZSC), entrada da outra aberta (ZSO) e bolsa ≥ LSL | intertravamento |
| Parada do S-501 (qualquer causa) | — | Fecha as duas saídas dos GH-1 | hardwired |
| Falha de sequência (ZSO/ZSC não confirmado) | 10 s | Para o S-501, fecha as saídas, abre as duas entradas, alarme | hardwired |
| LSHH da bolsa que recebe com a outra transferindo | 90% | Parte o S-501B | CLP |
| LAHH da bolsa que recebe | 95% | Para a transferência, fecha as saídas, abre as duas entradas; excesso pelo alívio conduzido | hardwired |
| LSLL de qualquer bolsa GH-1 | 10% | Fecha a saída dela e para o S-501 | hardwired |
| PSLL na bolsa que transfere | ≤ +0,5 mbar | Para o S-501 (a PCV-501 já estrangula a ≈ +0,3 mbar) | hardwired |
| PSLL na sucção do S-501 | −5 mbar | Para o S-501 (proteção da máquina) | hardwired |
| Falha do S-501A | — | Partida automática do S-501B | CLP |
| TSHH nos corta-chamas FA-501/502/503 | chama retida | Para o S-501 / fecha a XV-FL / isola o tie-in | hardwired |
| LSHH do GH-2 | 90% | Abre a XV-FL (flare); com o flare indisponível, para o S-501 | CLP |
| LSLL do GH-2 | 10% | Corta os consumidores (tie-in) e o flare | hardwired |
| PSHH no coletor do tie-in | > pressão do GH-2 + margem | Isola o tie-in (refluxo do SK-501, SP-09) | hardwired |
| O₂ no biogás (AT-501) | > 1% alarme / > 2% trip | Trip: para o S-501, o flare e as retiradas de líquido (entrada de ar) | hardwired |
| Detector de chama do flare | falha | Fecha a XV-FL; o GH-2 acumula | do skid |
| Detectores fixos CH₄ / H₂S | 10–20% LIE / 10 ppm | Alarme e trip local (sopradores, flare) | hardwired |
| Falta de energia | — | XV de entrada abrem, de saída fecham, PCP param; S-501, flare e CLP de segurança em energia de emergência | projeto |

## Monitoramento contínuo (supervisório)

| grandeza | onde | para quê |
|---|---|---|
| Nível (radar) | R-101/201/202, TQ-201, CS-301, TQ-301 | Controle das PCP (inversor), balanço de massa, detecção de saída obstruída |
| Pressão do espaço de gás (PT) | cada reator | Envelope ±, PAH/PAL; tendência de obstrução de ramal |
| Volume das bolsas (LT) | GH-1A/B, GH-2 | Alternância, produção de biogás (ΔV/Δt) |
| Vazão de gás (FT) | descarga S-501, tie-in, flare | Produção, consumo, queima |
| CH₄/CO₂/O₂/H₂S (AT-501) | coletor COL-501 | Qualidade, entrada de ar, dessulfurização |
| pH/ORP (PHIT-201) | TQ-201 | Dosagem de NaOH (DOS-201) e retorno RL-05 |
| Vazão de lodo (FIT) | purgas, P-201, P-301 | Q ≤ Q_máx; balanço de sólidos |
| Corrente e pressão das PCP | P-201, P-301 | Desgaste do estator, entupimento |
| ΔP e temperatura dos corta-chamas | FA-501/502/503 | Entupimento e chama retida |
| ZSO/ZSC de todas as XV e válvulas de bloqueio | gás e líquidos | Permissivos e sequências |
| Temperatura (TT) | reatores | Estabilidade mesofílica |
