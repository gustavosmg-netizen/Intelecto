# Estudo de alternativas — Gen E rev. 5 (planta enxuta)

Situação: **DOCUMENTO DE TRABALHO**, sujeito ao Crivo A–F. Indicadores físicos, sem valores monetários. Base: pedido do cliente (menos unidades; reavaliar sem o tanque de neutralização) e F02 Rev. B (C1) do chat de fluxogramas (`.claude/skills/fluxograma-pid/modelos/thermobiogasup_genE/PARECER_F02.md`, branch `claude/wizardly-volta-web5tm`).

## 1. Neutralização: tanque ou em linha

| | C1: TQ-201 fechado e equalizado ao R-101 | **C3: em linha (adotada)** |
|---|---|---|
| Unidades | tanque, agitador, linha de gás de equalização, linha de saída do R-101 por gravidade com selo | dosadora (skid), misturador estático, pH/ORP em linha |
| Pulmão de pH | ≈ 1 m³ no tanque | o próprio R-101 (≈ 5,6 m³ entre LSL e operação) e os metanogênicos (pulso de ≈ 0,7% do volume) |
| Segurança | +1 vaso fechado no envelope de pressão; IIC | um vaso a menos no envelope; a P-201 aspira o R-101 com reposição de gás (mesma regra das purgas) |
| Controle | pH no tanque | pH/ORP em linha + saída de cada metanogênico; pulso intertravado ao pH |
| Contrato | aderente ao item FINEP "tanques de neutralização" | exige consulta (LAC-054) |

O ganho de segurança do tanque era pequeno: ele separava os estágios, mas acrescentava um vaso fechado, uma linha de gás e uma linha de líquido. O pulmão de pH migra para o R-101, que passa a ter nível variável.

## 2. Alimentação dos reatores

| | Alça externa com ventosa ao gás (rev. 4) | **Tampo com tubo de imersão (C1, adotada)** | Tampo sem tubo (descarga direta no N1) |
|---|---|---|---|
| Hidráulica (τy alto) | AMT ≈ igual; descida DE160 cheia | AMT ≈ igual; tubo cheio abaixo do nível; no caso pessimista parte do pulso sai pelo furo | menor AMT; sem trecho cheio interno |
| Quebra-sifão | ventosa de esgoto em lodo (manutenção, falha) | furo no espaço de gás: passivo | inerente (descarga livre no gás) |
| Curto-circuito | entrada no fundo, saída no topo: ótimo | entrada a 1/3 da altura: bom | entrada na superfície, perto da saída por transbordo: **ruim nos R-201/202**, bom no R-101 (que sai pelo fundo) |
| Espuma e aerossol | — | baixo | queda livre de ≈ 1,8 m: respingo, espuma e arraste de gás |
| Escoramento | subida + crista + descida por reator (≈ 2 colunas de 10 m) | uma subida por reator | uma subida por reator |
| Interferência nos vasos Fibrais | nenhuma | tubo interno no N1 (carga, folga do misturador): **confirmar com a Fibrais** | nenhuma |
| Unidades | 3 ventosas, 3 linhas de gás das ventosas, 3 descidas, 3 válvulas no fundo | 3 tubos internos | — |

**Se a Fibrais não aceitar o tubo de imersão:**
- **R-101:** descarregar direto no N1. A saída é pelo fundo, então não há curto-circuito.
- **R-201/R-202:** descarregar direto no N1 mais afastado do N-SAI, com quatro condições:
  - pulso intertravado ao misturador em operação;
  - pulso pequeno (≈ 0,7% do volume);
  - ensaio com traçador na partida (LAC-047);
  - defletor curto no bocal, que é bem mais leve que o tubo, para não formar espuma.

## 3. Saída dos metanogênicos

| | Coluna externa a partir do N2 (C1) | U DN80 ao TQ-301 aberto | **N-SAI no nível + copos na CS-301 (mantida)** |
|---|---|---|---|
| Tubo cheio de polpa | ≈ 7 m (do fundo à crista) | ≈ 6 m + 4 curvas | só o tubo mergulhado (≈ 0,5 m) |
| Com τy = 100 Pa | ≈ 2 m de carga: o nível passaria do tampo | ≈ 5 m contra 2,8 m disponíveis: não escoa | folga de 1,2 m na soleira |
| Bocal novo no reator | não | não | sim (N-SAI DN150) |

## 4. Purgas

A P-302 dedicada sai. A P-301 faz as purgas por um manifold de sucção com chave presa, uma sucção por vez: CS-301, N3 do TQ-301 e purga de R-201 ou R-202. As purgas são curtas (minutos por dia) e a CS-301 tem horas de pulmão na vazão média (≈ 0,3 m³/h).

## 5. Indicadores físicos: rev. 4 × rev. 5 (das listas de materiais do modelo)

| indicador | rev. 4 | rev. 5 | Δ |
|---|---|---|---|
| tubo DE110 (m) | 96,3 | 89,6 | -6,8 |
| tubo DE160 (m) | 71,2 | 38,1 | -33,0 |
| tubo DE32 (m) | 0,0 | 2,1 | 2,1 |
| tubo DE63 (m) | 52,8 | 39,8 | -13,1 |
| tubo DE90 (m) | 77,8 | 75,2 | -2,6 |
| tubo total (m) | 298,1 | 244,8 | -53,3 |
| bocais novos nos tanques Fibrais existentes | 8 | 7 | -1 |
| bomba móvel de reserva | 1 | 1 | 0 |
| bombas instaladas | 3 | 2 | -1 |
| copos de selagem internos (no chão) | 3 | 2 | -1 |
| curvas | 93 | 65 | -28 |
| flanges cegos nos tanques Fibrais existentes | 19 | 23 | 4 |
| gasômetros | 3 | 3 | 0 |
| instrumentos de segurança | 11 | 13 | 2 |
| sopradores (skid A+B) | 2 | 2 | 0 |
| válvulas e ventosas | 55 | 50 | -5 |

**Unidades que saem na rev. 5:**
- TQ-201 com o agitador AG-200 e o FCA-201;
- copo CP-101;
- P-302;
- saída por transbordo do R-101 (bocal novo e respiro de equalização);
- 3 alças com ventosas e as linhas de gás delas;
- recirculação L-201RC.

**Unidades que entram:** skid de dosagem DOS-201, misturador estático MX-201, pH/ORP em linha e nos copos, e 3 tubos de imersão.

**Gás sem mudança:** GH-1A/B, S-501, GH-2 e flare, por decisão do cliente.
