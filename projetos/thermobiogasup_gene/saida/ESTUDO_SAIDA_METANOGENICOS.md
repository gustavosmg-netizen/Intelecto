# Estudo da saída dos metanogênicos — A′ (selo compacto) × B (TQ-301 fechado ao gás)

Situação: **DOCUMENTO DE TRABALHO**, sujeito ao Crivo A–F. Indicadores físicos, sem valores monetários. Base: modelo rev. 5 (`planta_gene.py`, `MEMORIA_HIDRAULICA.md`) e a nota técnica `NOTA_TECNICA_BIFASICO.md`. Figura: `ESTUDO_SAIDA_METANOGENICOS.png`.

## 1. O que está embolado na rev. 5

Cada metanogênico tem duas linhas até a CS-301:

- a saída SAI DE160, do N-SAI no nível até um copo de selagem dentro da CS-301 (≈ 6 m de queda);
- o respiro RS DE90, do tubo de saída até um N1 do tampo, que equaliza o gás do tubo quando a polpa afoga o N-SAI.

A CS-301 fica a ≈ 5 m dos reatores. Ela pede FCA-301, extravasor, dreno, 4 chaves de nível e a P-301 em operação contínua, que transfere tudo ao TQ-301, aberto. O selo separa dois espaços de gás e, por isso, exige uma caixa, dois copos e dois respiros.

## 2. As duas alternativas

| | **A′ — selo compacto** | **B — TQ-301 fechado ao gás** |
|---|---|---|
| Princípio | selo hídrico de 330 mm (≈ 33 mbar) entre reator e caixa | reatores e TQ-301 formam um só espaço de gás; não há o que selar |
| Saída | N-SAI → descida quase vertical a um copo na CS-301; ≈ 1,7 m na horizontal e 5,5 m de queda | N-SAI → rampa a 33° → N1 existente do TQ-301; 4,2 m na horizontal, 2,3 m de queda, 2 curvas |
| Respiro do tubo de saída | bocal novo DN80 no costado a +8,9 m, logo acima do N-SAI; ≈ 1,6 m de tubo | dispensado: o tubo de saída, parcialmente cheio, é o próprio caminho do gás |
| Caixa | CS-301 ao sul do vão entre os reatores, a ≈ 3,1 m do TQ-301; folga até cada reator ≈ 1,4 m | não existe |
| Bomba | P-301 contínua (CS-301 → TQ-301), mais purgas, RL-05 e expedição | P-301 só para purgas, RL-05 e expedição; sem transferência contínua |
| TQ-301 | aberto: respiro A7 com chapéu chinês | fechado: A7 vira válvula de pressão e vácuo (PVRV) com corta-chamas; M1 com tampa estanque; extravasor com selo de emergência; N1-270 e N1-90, hoje tamponados, viram chegadas |
| pH/ORP na saída | nos copos (AIT-212/222) | no reator, por porta da A4 multitomada com haste retrátil; em CSTR o pH do reator é o da saída |
| Gás do digestato | arrastado e residual vão à atmosfera (FCA-301 e A7) | recuperado no GH-1 |
| Bocais novos Fibrais (R-201/202) | 2× N-SAI DN150 e 2× RS DN80 de costado | 2× N-SAI DN150 |
| Fibrais no TQ-301 | nenhum | envelope de pressão e vácuo, tampa M1, PVRV no A7 e carga das chegadas no tampo (LAC-057) |

## 3. Hidráulica com polpa de Bingham (6 m³/h de pulso)

| caso | τy (Pa) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) | sen θ mín. exigido | sen θ B | raio de bolha retida (cm) |
|---|---|---|---|---|---|---|---|
| otimista | 5 | 0,06 | 7,56 | 0,64 | 0,012 | 0,54 | 0,3 |
| central | 30 | 0,17 | 7,67 | 0,53 | 0,069 | 0,54 | 2,1 |
| pessimista | 100 | 0,49 | 7,99 | 0,21 | 0,231 | 0,54 | 6,9 |

- **Subida na soleira:** igual nas duas alternativas, porque o N-SAI é o mesmo. O que muda é o que vem depois.
- **A′:** o copo cobra 0,27 m de carga (pessimista) e deixa 5,7 m de folga na soleira, como na rev. 5. A margem é grande, mas a polpa fica parada no copo entre os pulsos.
- **B:** descarga livre no espaço de gás do TQ-301. A rampa tem sen θ = 0,54, 2,4× o mínimo pessimista (0,231), então o tubo esvazia depois de cada pulso e não guarda polpa parada.
- **Gás em contracorrente (B):** o enchimento do TQ-301 desloca gás para cima pelo tubo de saída. Com a vazão de pulso inteira num só tubo, a velocidade fica em 0,13 m/s e a perda em 0,000 mbar. Não há inundação nem arraste de lâmina.
- **Corte da alimentação (B):** os dois reatores escoam ao TQ-301 até a soleira, cerca de 1,42 m³ no caso que escoa mais (otimista). Entre o LSHH (+3,85) e o extravasor (+4,00) cabem só 1,06 m³. Por isso o LSHH desce para +3,70, com o LSH logo abaixo, e o volume útil cai ≈ 1,1 m³.

## 4. Sólidos, espuma e gás

| aspecto | A′ | B |
|---|---|---|
| Bolhas retidas na polpa | com τy ≥ 30 Pa, bolhas de até 2–7 cm de raio não sobem; o gás desce com a polpa, solta-se no ânulo do copo e vai ao FCA-301 ou ao TQ-301 aberto | solta-se no espaço de gás do TQ-301, que é recuperado |
| Espuma | o N-SAI no nível puxa a espuma primeiro. Espuma no copo vale pouco como selo: com 50% de gás, os 330 mm dão ≈ 17 mbar; com 80%, ≈ 7 mbar, abaixo dos +12 mbar do dispositivo de emergência | a espuma fica no envelope fechado; risco de chegar ao PVRV do A7 (LSHH e sonda de espuma) |
| Sedimentação | ânulo do copo a ≈ 7 mm/s no pulso, parado entre pulsos: areia e crosta no fundo do copo (folga de 200 mm) e na CS-301 | só o fundo cônico do TQ-301, que já é ponto de dreno (N3) |
| Limpeza | copos dentro da CS-301 fechada: espaço confinado com H₂S, ou bicos de lavagem | tê de lavagem no início da rampa; rampa autolimpante |
| Emissões de CH₄ | gás arrastado e dissolvido, mais a produção residual no TQ-301 aberto | recuperadas |

## 5. Segurança e a regra de retiradas do cliente

**A′:**
- O selo isola o reator: retirar do TQ-301 não mexe no gás do reator.
- Perda de selo ocorre por evaporação, espuma ou nível baixo nos copos; o AIT nos copos e o LSLL da CS-301 vigiam.
- A CS-301 é um espaço com biogás arrastado (zona classificada) ventilado para a atmosfera.

**B:**
- O TQ-301 entra no envelope (+0,5 a 2,2 mbar normal; emergência +12/−5 mbar). Ver LAC-057.
- A expedição e o RL-05 tiram polpa de um espaço de gás. Valem as mesmas regras das purgas:
  - só pela P-301, com vazão limitada pela bomba;
  - permissivo de volume na bolsa GH-1 que está recebendo (≥ volume retirado + 10 m³) e de pressão ≥ −0,5 mbar;
  - nenhum caminhão a vácuo nem tampa aberta.
- Para manter o TQ-301 é preciso fechar V-201SAI e V-202SAI, o que para a alimentação. A emergência é a purga pela P-301 ao caminhão, com a mesma reposição de gás.
- A entrada de ar é o risco principal. Barreiras:
  - tampa M1 estanque;
  - amostragem por válvula dupla;
  - O₂ no AT-501.

## 6. Indicadores físicos do trecho (estimativa de estudo, antes de modelar)

| indicador | rev. 5 | A′ | B |
|---|---|---|---|
| vasos | CS-301 + TQ-301 | CS-301 + TQ-301 | TQ-301 |
| copos de selagem | 2 | 2 | 0 |
| linhas de respiro RS | 2 (ao tampo) | 2 (curtas, costado) | 0 |
| filtro de carvão | FCA-301 | FCA-301 | 0 (PVRV no A7) |
| chaves de nível dedicadas | 4 (CS-301) | 4 (CS-301) | 0 (só o TQ-301) |
| transferência contínua | P-301 | P-301 | não |
| bocais novos nos reatores existentes | 2 DN150 | 2 DN150 + 2 DN80 | 2 DN150 |
| bocais novos no TQ-301 | 2 (N-EXT, N-LSHH) | 2 | 2 (+ PVRV no A7) |
| pontos onde a polpa fica parada | 2 copos + caixa | 2 copos + caixa | fundo do TQ-301 |
| gás do digestato | emitido | emitido | recuperado |

## 7. Recomendação técnica

**B é a mais simples e a mais limpa hidraulicamente**:
- uma rampa curta por reator, que se esvazia sozinha;
- nenhuma polpa parada fora do TQ-301;
- espuma e bolhas retidas ficam dentro do envelope de gás, sem emissão;
- saem do projeto uma caixa, dois copos, dois respiros, um filtro e a transferência contínua.

Ela depende de uma condição: **a Fibrais confirmar que o TQ-301 suporta o envelope de gás (LAC-057)**. Se não suportar, a A′ resolve o "embolado" com menos risco de projeto. Mas a A′ mantém o ponto fraco do selo com espuma e as emissões do digestato.

## 8. Lacunas novas

- **LAC-057:** TQ-301 (315A-25) fechado ao gás: pressão e vácuo admissíveis (alvo ≥ +15/−6 mbar com o PVRV acima da emergência dos reatores), estanqueidade da tampa M1, troca do chapéu chinês do A7 por PVRV com corta-chamas, carga das duas chegadas DE160 nos N1-90/N1-270 e defletor interno anti-espuma — Fibrais.
- **LAC-058:** Digestato dos R-201/202: retenção de gás (densidade da amostra fresca × desgaseificada), CH₄ dissolvido e potencial de metano residual na temperatura de armazenamento — laboratório (fecha o balanço de emissões da A′).
- **LAC-059:** Potencial de espuma da polpa dos metanogênicos (ensaio de aeração padronizado), para dimensionar sonda de espuma e defletor — laboratório.
- **LAC-060:** Só na A′: dois bocais DN80 de costado a +8,9 m nos R-201/202 (respiro do tubo de saída) — Fibrais.
