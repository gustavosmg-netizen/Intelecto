# Estudo de alternativas — coleta, bombeamento e gás (Gen E rev. 4)

Situação: **DOCUMENTO DE TRABALHO**, sujeito ao Crivo A–F. Indicadores físicos; sem valores monetários (CLAUDE.md do projeto).

## 1. Líquidos: como selar e coletar a saída dos reatores

Restrições do problema:
- Os reatores são fechados e não podem ter pressão positiva ou negativa.
- Os tanques Fibrais já estão fabricados: aceitam bocais novos, mas não vertedores internos.
- A coleta deve ficar no nível do chão.
- O TQ-301 recebe por cima (+4,66) e o R-101 está só 1,0 m acima da entrada do TQ-201.
- Com τy alto, cada curva de tubo cheio custa ≈ 0,5 m de carga.

| alternativa | como funciona | prós | contras | decisão |
|---|---|---|---|---|
| A. Potes elevados (rev. 3) | descida → pote com tubo mergulhado a +2,4/+6,3 m → transbordo ao destino | só gravidade; selo independente do nível | potes e válvulas a +6 m sobre estrutura; acesso e limpeza difíceis; folga na soleira de só 0,35–0,6 m (τy alto) | descartada pelo cliente |
| B. Selo no próprio tanque de destino | tubo mergulhado no líquido do TQ-201/TQ-301 abaixo do LSLL | sem caixa e sem bomba | o selo depende do nível do tanque; no TQ-301 (cônico, existente) os tubos teriam de entrar pela M1 central; submersão variável de até 2,7 m custa ≈ 1 m de carga com τy alto | descartada |
| C. U no chão até o N2 lateral existente do TQ-301 (+2,48) | descida ao chão e subida cheia até o N2 | só gravidade; usa bocal existente | ≈ 7 m de tubo cheio nas pernas; com τy = 100 Pa o nível no reator passa da soleira (≈ +8,0 m); DN250 resolveria a carga, mas a polpa sedimenta a 0,03 m/s | descartada |
| D. Caixa no chão por reator + bomba própria | 3 caixas e 3 bombas de transferência | selos acessíveis | +3 bombas, energia, manutenção e intertravamentos | descartada |
| **E. Copos internos nos tanques do chão (recomendada)** | R-101 → copo CP-101 dentro do TQ-201 (tanque novo, no chão); R-201/202 → copos CP-201/202 dentro da caixa CS-301 no chão; P-301 junto à CS-301 transfere ao TQ-301 | selo de 330 mm independente do nível (borda do copo acima do máximo do tanque); tudo no chão, limpável; nenhum vertedor em tanque existente; folga na soleira ≥ 1,2 m; purgas limitadas fisicamente pela P-302 volumétrica com reposição de gás | a P-301 passa a trabalhar contínua (≈ 0,08 kWh/m³), com reserva móvel; +1 bomba (P-302) | **adotada** |

## 2. Gás: como os reatores entregam e de onde se retira

| alternativa | como funciona | resultado | decisão |
|---|---|---|---|
| G1. Gasômetro único de baixa pressão com retirada simultânea (RES-001) | sopradores aspiram o gasômetro enquanto os reatores entregam; proteção por válvula mantenedora + PALL | atende a RES-001, mas a retirada acontece com a fonte ligada | descartada pela regra do cliente |
| G2. GH-1 único em batelada (entrada fechada durante a transferência) | o reator fica sem destino enquanto o GH-1 transfere | 50 m³ de espaço de gás recebendo ≈ 34 m³/h: +50 mbar em 5 min, acima do envelope de +15 | inviável |
| **G3. GH-1A/GH-1B alternando + GH-2 (recomendada)** | uma bolsa recebe (entrada aberta, saída fechada), a outra transfere pela linha exclusiva com anti-retorno | reatores a +0,5–2,2 mbar; sopradores nunca enxergam o coletor; retiradas de líquido com reposição de gás da bolsa que recebe | **adotada** |
| G4. Gasômetro de dupla membrana ligado direto aos reatores | 15–30 mbar no coletor | acima do envelope dos reatores | inviável |

## 3. Indicadores físicos: rev. 3 × rev. 4 (das listas de materiais do modelo)

| indicador | rev. 3 (potes elevados) | rev. 4 (copos no chão + gás) | Δ |
|---|---|---|---|
| tubo DE110 (m) | 19,9 | 96,3 | 76,5 |
| tubo DE160 (m) | 60,6 | 71,2 | 10,5 |
| tubo DE63 (m) | 22,5 | 52,8 | 30,4 |
| tubo DE90 (m) | 72,2 | 77,8 | 5,6 |
| tubo total (m) | 175,2 | 298,1 | 122,9 |
| bocais novos nos tanques Fibrais existentes | 8 | 8 | 0 |
| bomba móvel de reserva | 0 | 1 | 1 |
| bombas instaladas | 2 | 3 | 1 |
| copos de selagem internos (no chão) | 0 | 3 | 3 |
| curvas | 75 | 93 | 18 |
| flanges cegos nos tanques Fibrais existentes | 17 | 19 | 2 |
| gasômetros | 0 | 3 | 3 |
| instrumentos de segurança | 2 | 11 | 9 |
| potes elevados sobre estrutura | 3 | 0 | -3 |
| sopradores (skid A+B) | 0 | 2 | 2 |
| válvulas e ventosas | 35 | 55 | 20 |

Leitura dos indicadores:
- **Escopo diferente:** a rev. 4 inclui o sistema de gás completo (gasômetros, sopradores, flare, potes de condensado, corta-chamas e instrumentos), que na rev. 3 terminava num tie-in.
- **Líquidos:** os potes elevados e a estrutura deles saem. Entram os copos internos e a CS-301, tudo no chão.
- **Energia (OPEX):**
  - P-201 ≈ 0,12 kWh/m³ e P-301 ≈ 0,08 kWh/m³ no caso central;
  - sopradores ≈ 0,11 kW no eixo, ≈ 56% do tempo (≈ 1,5 kWh/d).
  - Manutenção dominante: estatores das PCP (reserva em almoxarifado) e ventosas de esgoto.
  - Ficam fora destes indicadores e entram no OPEX do S8: ventilador de suporte do GH-2, agitadores, carvão dos FCA, água de reposição dos selos e energia de emergência.
- **Purgas:** na rev. 3 eram feitas pela P-301 aspirando os reatores. Na rev. 4 há a P-302 dedicada: +1 bomba, com limite físico de vazão.

## 4. Operação e segurança da alternativa adotada

- **Selos:** três copos de 330 mm, independentes do nível, mais o selo hidráulico e a emergência em cada reator e o selo d'água de alívio de cada gasômetro.
- **Quebra-sifão:** respiro de equalização em cada saída, ventosa ligada ao gás em cada alça e ventosa a ar na crista da L-301R.
- **Gasômetros:** alternância intertravada GH-1A/B, válvula mantenedora de pressão (mecânica) e alívio conduzido.
- **By-passes:**
  - engate de bomba móvel na CS-301 (by-pass da P-301 e da P-302);
  - sucção alternativa da P-301 pelo N3 do TQ-301;
  - BYP-501 do GH-2 ao flare com chave presa;
  - duas bolsas GH-1, uma de reserva da outra.
- **Verificações (anti-retorno):** retenção de esfera nas PCP, retenções na saída de cada GH-1, na descarga dos sopradores e no tie-in dos consumidores.
- **Monitoramento:** ver MATRIZ_CAUSA_EFEITO.md.
