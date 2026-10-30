# Estudo da saída dos metanogênicos — A′ (selo compacto) × B (TQ-301 fechado ao gás)

Situação: **DOCUMENTO DE TRABALHO**, revisado pelo Crivo A–F independente e corrigido. Indicadores físicos, sem valores monetários. Base:
- o modelo rev. 5 (`planta_gene.py`, `MEMORIA_HIDRAULICA.md`);
- a nota técnica `NOTA_TECNICA_BIFASICO.md`;
- a figura `ESTUDO_SAIDA_METANOGENICOS.png`.

Posições, comprimentos e cotas marcados **(estudo)** são de arranjo preliminar e serão fechados na modelagem 3D da alternativa escolhida.

## 1. O que está embolado na rev. 5

Cada metanogênico tem duas linhas até a CS-301:

- a saída SAI DE160, do N-SAI no nível até um copo de selagem dentro da CS-301 (≈ 6 m de queda);
- o respiro RS DE90, do tubo de saída até o N1-225 do tampo.

O respiro existe porque o N-SAI trabalha **afogado** durante o pulso. A geratriz superior interna do bocal fica a +7,647, e o nível chega a +7,69 no caso central e a +8,03 no pessimista. Com o bocal afogado, o gás do tubo de saída não volta ao reator pelo próprio bocal.

A CS-301 fica a ≈ 5 m dos reatores e pede:
- o FCA-301;
- extravasor e dreno;
- 4 chaves de nível;
- a P-301 em operação contínua, que transfere tudo ao TQ-301, aberto.

## 2. As duas alternativas

| | **A′ — selo compacto** | **B — TQ-301 fechado ao gás** |
|---|---|---|
| Princípio | selo hídrico de 330 mm (≈ 33 mbar) entre reator e caixa | reatores e TQ-301 formam um só espaço de gás; a saída não precisa de selo |
| Saída | N-SAI → descida quase vertical a um copo na CS-301: ≈ 1,5 m na horizontal e 5,5 m de queda (estudo) | N-SAI → rampa a 34° → N1 do TQ-301: 4,2 m na horizontal, 2,3 m de queda, 2 curvas |
| Gás do tubo de saída | respiro curto por bocal novo DN80 de costado a +8,9 m, ≈ 1,6 m (**A′1**), ou pelo N1-225 existente, longo como na rev. 5 (**A′2**) | o tubo descarrega no espaço de gás do TQ-301, que se equaliza pela linha dedicada **LE-301** DE110 (≈ 25 m, estudo) até o COL-501, com pote de condensado PC-301 |
| Caixa | CS-301 ao sul do vão entre os reatores (estudo). Folga ≈ 1,2 m até cada reator e ≈ 0,9 m até o TQ-301 | não existe |
| Bomba | P-301 contínua (CS-301 → TQ-301), mais purgas, RL-05 e expedição | P-301 só para purgas, RL-05 e expedição; sem transferência contínua |
| TQ-301 | aberto: respiro A7 com chapéu chinês | fechado:
- A7 com PVRV e corta-chamas;
- M1 com tampa nova, estanque, com bocais para a LE-301 e o retorno da P-301;
- extravasor com selo de emergência SO-301 de 450 mm;
- N1-270 (sai da P-301) e N1-90 (hoje tamponado) passam a receber as rampas. |
| pH/ORP na saída | nos copos (AIT-212/222), como na rev. 5 | bocal novo DN50 no costado de cada reator, abaixo da soleira, com haste retrátil (LAC-061). Em CSTR o pH do reator é o da saída. O A4 fica reservado (LAC-038/048) |
| Gás do digestato | arrastado e residual vão à atmosfera (FCA-301 e A7; LAC-049) | recuperado no GH-1 |
| Bocais novos nos R-201/202 | 2× N-SAI DN150 (+ 2× DN80 na A′1) | 2× N-SAI DN150 + 2× DN50 |
| Fibrais no TQ-301 | nenhum | envelope, tampa M1 com bocais, PVRV no A7 e carga das chegadas (LAC-057) |

**Azimutes do N-SAI.** Mudam em relação à rev. 5:

| reator | rev. 5 | A′ | B |
|---|---|---|---|
| R-201 | 182° | 129° | 162° |
| R-202 | 230° | 231° | 198° |

A alternativa adotada gera uma revisão do BOCAIS_FIBRAIS.

## 3. Hidráulica com polpa de Bingham (6 m³/h de pulso)

| caso | τy (Pa) | subida na soleira (m) | nível máx. (m) | folga até LSH (m) | N-SAI afogado? | sen θ mín. exigido | sen θ B | lâmina parada na rampa B (mm) |
|---|---|---|---|---|---|---|---|---|
| otimista | 5 | 0,06 | 7,56 | 0,64 | não | 0,012 | 0,56 | 1 |
| central | 30 | 0,19 | 7,69 | 0,51 | sim | 0,069 | 0,56 | 5 |
| pessimista | 100 | 0,53 | 8,03 | 0,17 | sim | 0,231 | 0,56 | 18 |

**Subida na soleira.** É igual nas duas alternativas e igual à rev. 5, porque o N-SAI e o trecho horizontal (faca + tê de lavagem) são os mesmos.

**A′.** O copo cobra 0,27 m de carga (pessimista) e deixa 5,7 m de folga na soleira, como na rev. 5. A margem é grande, mas a polpa fica parada no copo entre os pulsos.

**B.** A rampa tem sen θ = 0,56, 2,4× o mínimo pessimista.
- Ela não esvazia de todo: uma polpa de Bingham para quando a tensão na parede cai abaixo de τy.
- Fica uma lâmina de raio hidráulico ≈ τy/(ρ·g·sen θ), de ≈ 18 mm no caso pessimista (meia-lua de ≈ 1/4 do diâmetro).
- O trecho horizontal do N-SAI retém alguns litros.
- O tê de lavagem no início da rampa limpa as duas coisas nas paradas longas.

**Gás no B.** O enchimento do TQ-301 por um pulso (6 m³/h) e a expedição pela P-301 (6 m³/h) trocam gás com o coletor pela LE-301. Com 12 m³/h, a velocidade é 0,45 m/s e a perda 0,014 mbar, desprezível diante do permissivo de −0,5 mbar.

**Corte da alimentação (B).** Os dois reatores escoam ao TQ-301 até a soleira, ≈ 1,42 m³ no caso que mais escoa (otimista). Entre o LSHH atual (+3,85) e o extravasor (+4,00) cabem 1,06 m³.
- O LSHH desce para +3,70 e o N-LSHH, bocal novo, é posicionado nessa cota.
- O volume útil (LSL–LSH) não muda.
- A faixa entre LSH e LSHH cai para 0,71 m³.

## 4. Sólidos, espuma e gás

| aspecto | A′ | B |
|---|---|---|
| Bolhas retidas na polpa | com τy ≥ 30 Pa, bolhas de até 2–7 cm de raio não sobem; o gás desce com a polpa, solta-se no ânulo do copo e vai ao FCA-301 ou ao TQ-301 aberto | solta-se no espaço de gás do TQ-301, que é recuperado |
| Espuma | o N-SAI no nível puxa a espuma primeiro. No copo, a espuma vale pouco como selo: com 50% de gás os 330 mm dão ≈ 17 mbar; com 80%, ≈ 7 mbar, abaixo do dispositivo de emergência | a espuma fica no envelope fechado. Riscos: chegar ao PVRV ou à LE-301 (sonda de espuma no TQ-301, LAC-059) e enfraquecer o selo SO-301 (dimensionado com 50% de espuma) |
| Sedimentação | ânulo do copo a ≈ 7 mm/s no pulso e parado entre pulsos: areia e crosta no fundo do copo (folga de 200 mm) e na CS-301 | fundo cônico do TQ-301, que já é ponto de dreno (N3); lâmina residual na rampa |
| Limpeza | copos dentro da CS-301 fechada: espaço confinado com H₂S, ou bicos de lavagem | tê de lavagem no início da rampa |
| Emissões de CH₄ | gás arrastado e dissolvido, mais a produção residual no TQ-301 aberto | recuperadas; o tamanho do ganho depende da LAC-058 |

## 5. Segurança e a regra de retiradas do cliente

### A′

- O selo isola o reator: retirar do TQ-301 não mexe no gás do reator.
- O selo pode se perder por evaporação, espuma ou nível baixo nos copos. O AIT nos copos e o LSLL da CS-301 vigiam.
- A CS-301 recebe biogás arrastado: é zona classificada e ventila à atmosfera pelo FCA-301.

### B

**1. Envelope.** O TQ-301 passa a operar como os reatores: +0,5 a 2,2 mbar normal e vácuo até o permissivo de −0,5 mbar.
- O dispositivo de emergência dos reatores aparece como +12 mbar no modelo e +8 mbar (selo hidráulico) na MEMORIA_GAS. Essa divergência vem de antes deste estudo e é harmonizada na LAC-057.
- O PVRV do TQ-301 fica acima da emergência (alvo +15 mbar).
- A capacidade do PVRV cobre:
  - a entrada de 2 pulsos;
  - a P-301;
  - o caso fogo (ISO 28300);
  - no vácuo, a vazão de expedição.

**2. Extravasor selado SO-301.** Fica normalmente seco, com selo de água de 450 mm e chave de nível baixo.
- O PVRV pede pelo menos 148 mm.
- Com 50% de espuma, os 450 mm valem 23 mbar, ainda acima dos 15 mbar.
- É o único selo de polpa da B e é de emergência. As barreiras primárias são o LSHH (trip da P-201) e o LSH.

**3. Retiradas do TQ-301 (expedição, RL-05).** Seguem a regra do cliente para retiradas, a mesma das purgas:
- só pela P-301, com vazão limitada pela bomba;
- reposição de gás pela LE-301 a partir da bolsa GH-1 que está recebendo;
- permissivo de volume na bolsa ≥ volume retirado + 10 m³ e de pressão ≥ −0,5 mbar;
- nenhum caminhão a vácuo e nenhuma tampa aberta.

O RL-05 contínuo precisa entrar nesse permissivo: a MATRIZ hoje não admite outra retirada simultânea, e isso será harmonizado na adoção.

**4. Entrada de ar.** É o risco principal. Barreiras:
- tampa M1 estanque;
- amostragem por válvula dupla;
- O₂ no AT-501;
- inertização com N₂ e purga antes de abrir o TQ-301 para manutenção.

**5. Zona classificada.** O interior do TQ-301 é zona 0, e há zonas em torno do PVRV e do ponto de expedição (LAC-009).

**6. Materiais.** O H₂S ataca os metálicos internos do TQ-301 (escada, parafusos, suportes): material resistente (LAC-057).

**7. Condensado.** O gás termofílico condensa no TQ-301, mais frio. O condensado volta ao digestato, e a LE-301 desce até o PC-301.

**8. Manutenção do TQ-301.** Fechar V-201SAI e V-202SAI para a alimentação. A emergência é a purga pela P-301 ao caminhão, com a mesma reposição de gás.

## 6. Indicadores físicos do trecho (estimativa de estudo, antes de modelar)

| indicador | rev. 5 | A′1 / A′2 | B |
|---|---|---|---|
| vasos | CS-301 + TQ-301 | CS-301 + TQ-301 | TQ-301 + pote PC-301 |
| copos de selagem (operação) | 2 | 2 | 0 |
| selos de emergência | 0 | 0 | 1 (SO-301, normalmente seco) |
| linhas de gás do trecho | 2 RS ao tampo | 2 RS curtas / 2 RS ao tampo | 1 (LE-301) |
| filtro de carvão | FCA-301 | FCA-301 | 0 (PVRV no A7) |
| chaves de nível da CS-301 | 4 | 4 | 0 |
| transferência contínua | P-301 | P-301 | não |
| bocais novos nos reatores existentes | 2 DN150 | 2 DN150 + 2 DN80 / 2 DN150 | 2 DN150 + 2 DN50 |
| intervenções no TQ-301 | N-EXT, N-LSHH | N-EXT, N-LSHH | N-EXT, N-LSHH, tampa M1 com bocais, PVRV no A7 |
| pontos onde a polpa fica parada | 2 copos + caixa | 2 copos + caixa | fundo do TQ-301 + lâmina nas rampas |
| gás do digestato | emitido | emitido | recuperado |

## 7. Recomendação técnica

**B continua a mais simples e a mais limpa hidraulicamente**, mesmo com a LE-301 e o SO-301:
- uma rampa curta por reator;
- nenhuma caixa nem copo em operação;
- espuma e bolhas retidas dentro do envelope de gás;
- saem uma caixa, dois copos, dois respiros, o filtro e a transferência contínua; entram uma linha de gás, um pote e um selo de emergência.

**Condição:** a Fibrais confirmar que o TQ-301 suporta o envelope (LAC-057).

Se não suportar, a **A′** resolve o "embolado" com menos risco de projeto:
- **A′1:** respiro curto, mas com bocal novo de costado (LAC-060);
- **A′2:** sem bocal novo, mas mantém a linha ao tampo.

Nas duas variantes ficam o ponto fraco do selo com espuma e as emissões do digestato.

## 8. Lacunas novas

- **LAC-057:** TQ-301 (315A-25) fechado ao gás, a confirmar com a Fibrais:
  - pressão e vácuo admissíveis (alvo ≥ +15/−6 mbar, com o PVRV acima da emergência dos reatores);
  - harmonizar a emergência dos reatores (+12 mbar no modelo × +8 mbar na MEMORIA_GAS);
  - estanqueidade e tampa nova da M1 com bocais (LAC-029);
  - PVRV com corta-chamas no A7, dimensionado pela ISO 28300;
  - carga das duas chegadas DE160 nos N1-90 e N1-270;
  - material dos metálicos internos (H₂S);
  - envelope garantido (LAC-031).
- **LAC-058:** Digestato dos R-201/202, por laboratório:
  - retenção de gás (densidade da amostra fresca × desgaseificada; a faixa de 1–5% v/v usada no estudo é hipótese);
  - CH₄ dissolvido;
  - potencial de metano residual na temperatura e no tempo de residência do TQ-301.
  Fecha o balanço de emissões e completa a LAC-049.
- **LAC-059:** Potencial de espuma da polpa dos metanogênicos, por ensaio de aeração padronizado em laboratório. Dimensiona a sonda de espuma do TQ-301, o defletor e o selo SO-301.
- **LAC-060:** Só na A′1: dois bocais DN80 de costado a +8,9 m nos R-201/202, respiro do tubo de saída (Fibrais).
- **LAC-061:** Só na B: dois bocais DN50 de costado abaixo da soleira nos R-201/202 para pH/ORP com haste retrátil (Fibrais).
