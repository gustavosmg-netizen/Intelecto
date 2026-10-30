# Matriz de causa e efeito e monitoramento — Gen E rev. 5 (documento de trabalho)

Base: RES-001 §5.6 e as regras do cliente (retiradas só por linha exclusiva, com anti-retorno e a fonte em recebimento). Os ajustes são propostas, a confirmar no HAZOP/LOPA. As SIF exigem sensores independentes dos de controle (LAC-048).

| iniciador | ajuste | ação | tipo |
|---|---|---|---|
| LSHH de reator (R-101/201/202) | +4,35 / +8,35 m | Para a alimentação daquele reator (P-101 ou P-201, com a XV de alternância); alarme | SIF / hardwired |
| LSH de reator | +4,20 / +8,20 m | Alarme (saída obstruída?) | alarme |
| PAH / PAHH do reator | +5 / +6 mbar | PAHH: para a alimentação; parte S-501B e abre a XV-FL; último recurso: alívio conduzido do GH-1 | SIF a definir no HAZOP |
| PAL / PALL do reator (PT independente do PT de controle) | −0,5 / −1,5 mbar | PAL: interrompe o pulso e a purga. PALL: fecha as XV de purga, a XV-101S e as saídas dos GH-1; para P-201, P-301 em purga e S-501 | hardwired |
| PALLL do reator (antes do selo, −3 mbar) | −2,5 mbar | Trip geral das retiradas e alarme de entrada de ar iminente (selo e M2 admitem ar num espaço IIC) | SIF (LOPA) |
| ZSC da V-xSAI / V-xRS ou da V-xGAS fechada | — | Bloqueia a alimentação do reator (saída ou gás isolados) | permissivo |
| LSLL do R-101 | +2,40 m | Para a P-201 e fecha a XV-101S (não esvazia o acidogênico) | SIF |
| LSL do R-101 | +2,80 m | Bloqueia novo pulso da P-201 | permissivo |
| pH em linha fora da faixa (AIT-201/201B) | a definir (≈ 6,5–7,5; alto e baixo) | Interrompe o pulso (fecha XV-211/221, para a P-201 e a DOS-201); alarme | CLP |
| pH/ORP na saída de um metanogênico (AIT-212/222) | a definir | Alarme; reduz a carga daquele reator (menos pulsos) | CLP |
| Falha da dosadora (FIT-DOS sem vazão) | — | Interrompe o pulso | CLP |
| Dosagem sem vazão da P-201 (FQIT-201 < mínimo) | — | Para a DOS-201 (evita tampão de pH alto na linha) | intertravamento |
| Desvio entre AIT-201 e AIT-201B | > 0,3 pH | Interrompe o pulso; alarme de calibração (2oo2) | CLP |
| XV-RL05 (retorno alcalino à sucção da P-201) | — | Falha-fecha; só abre com P-201 E P-301 em marcha; FIT-RL05 ≤ fração da vazão da P-201 | intertravamento |
| XV-101AL (alimentação do R-101) | — | Falha-fecha; só aberta com a P-101 em marcha (sem retorno à Ilha 1) | intertravamento |
| Misturador do reator de destino parado | — | Bloqueia o pulso para aquele reator (curto-circuito) | permissivo |
| LSLL da CS-301 | +0,70 m | Para a P-301 | hardwired |
| LSHH da CS-301 | +1,10 m | Para a P-201 e a P-301 em purga e fecha as XV de purga | hardwired |
| LSHH do TQ-301 | +3,85 m | Para a P-301 na transferência (a CS-301 sobe até o LSHH e corta a P-201) | hardwired |
| PSHH na descarga das PCP | abaixo da classe do PEAD | Trip da bomba (a PSV alivia antes de qualquer válvula) | hardwired |
| PSL na sucção das PCP | — | Trip da bomba (marcha a seco) | hardwired |
| Permissivo de retirada do R-101 (pulso da P-201) e de purga (P-301) | — | V-xGAS aberta (ZSO); volume da bolsa que recebe ≥ volume do pulso + 10 m³; pressão do reator ≥ −0,5 mbar durante a retirada; destino < LSH; nenhuma outra retirada; a XV abre só com a bomba em marcha e fecha com ela | permissivo |
| Permissivo de purga (adicional) | — | CS-301 ≤ LSL e ≥ 30 min após o último pulso (a V-301S fica fechada durante a purga) | permissivo |
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
| Nível (radar) | R-101/201/202, CS-301, TQ-301 | Controle das PCP (inversor), balanço de massa, detecção de saída obstruída |
| Pressão do espaço de gás (PT) | cada reator | Envelope ±, PAH/PAL; tendência de obstrução de ramal |
| Volume das bolsas (LT) | GH-1A/B, GH-2 | Alternância, produção de biogás (ΔV/Δt) |
| Vazão de gás (FT) | descarga S-501, tie-in, flare | Produção, consumo, queima |
| CH₄/CO₂/O₂/H₂S (AT-501) | coletor COL-501 | Qualidade, entrada de ar, dessulfurização |
| pH/ORP em linha (AIT-201) | entrada dos metanogênicos | Dosagem (DOS-201) e razão do RL-05 |
| pH/ORP (AIT-212/222) | copo de saída de cada metanogênico na CS-301 | Estabilidade da metanogênese |
| Vazão de lodo (FIT) | purgas, P-201, P-301 | Q ≤ Q_máx; balanço de sólidos |
| Corrente e pressão das PCP | P-201, P-301 | Desgaste do estator, entupimento |
| ΔP e temperatura dos corta-chamas | FA-501/502/503 | Entupimento e chama retida |
| ZSO/ZSC de todas as XV e válvulas de bloqueio | gás e líquidos | Permissivos e sequências |
| Temperatura (TT) | reatores | Estabilidade mesofílica |
