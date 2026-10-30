# Parecer técnico — Configuração da F02 (cascata anaeróbia, neutralização e biofertilizante)

| Campo | Registro |
|---|---|
| Projeto | ThermoBiogasUp · CSTR / FINEP 0786/23 · alternativa **Gen E** |
| Objeto | P&ID TBU-GENE-PID-F02 Rev. A (exemplo da skill `fluxograma-pid`) e a interface com o lado de gás |
| Base | `PROJETO_EXECUTIVO_OFICIAL`: CLAUDE.md Rev01-A (D1–D6), Bases e Critérios REV00, Matriz S0, Registro de Lacunas (40), RES-001 REV03, Ata ATA-DIR-CSTR-001 (minuta) |
| Natureza | **Parecer de engenharia, não emitido pelo projeto.** Não substitui a S1/S3/S4 nem a decisão do RT. Sem valores monetários (regra §2.8): custos em quantitativos e custo relativo |
| Data | 30/10/2026 |

## 1. Conclusão

**A arquitetura da Gen E para a F02 é boa na essência e deve ser mantida:** dois estágios em
cascata, transferência ácido → metanogênico por bomba, e descarga metanogênico → biofertilizante
por gravidade. A gravidade, em particular, é a escolha mais segura para o envelope de vácuo dos
reatores: líquido só sai quando entra líquido, então **não existe o cenário de vácuo por
retirada** (VC-03/VC-09) nessa saída.

**A forma como a F02 Rev. A materializa a arquitetura, porém, tem cinco falhas de concepção**
que convém corrigir antes da S3. A configuração recomendada (**C1**, seção 5) resolve as cinco.
Ela não compra nada novo de porte e cabe nos 4 bocais N1 do tampo, já existentes:

| # | Falha da Rev. A | Disciplina | Gravidade |
|---|---|---|---|
| F1 | **Quebra-vácuo da alça de alimentação aberto para a atmosfera.** Ao parar a bomba, a perna descendente drena e admite **ar**; na partida seguinte, o ar é empurrado para dentro do reator (O₂ no espaço de gás, contra o OP-05 e o SP-08) | Segurança de processo | **Alta** |
| F2 | **Entrada (N2-A) e saída (N2-B) na mesma cota (+0,30 m).** Abre caminho preferencial entre alimentação e descarga (curto-circuito). O risco é maior no R-101 (TRH 3,9 d) e com o misturador intermitente | Processo | **Alta** |
| F3 | **TQ-201 aberto, com agitação, recebendo efluente ácido com H₂S e H₂ dissolvidos.** Faz stripping de H₂S (NR-15), odor e área classificada no entorno, e exige sifão U entre R-101 e TQ-201 | Segurança ocupacional / ambiental | **Alta** |
| F4 | **Colunas de saída nivelada sem quebra-sifão desenhado.** Sem o respiro do topo da coluna ligado ao espaço de gás (RES-001 §5.6), a coluna pode sifonar e esvaziar o reator, o que gera vácuo | Hidráulica / segurança | Média–alta |
| F5 | **Alimentação dos dois metanogênicos em paralelo por um único barrilete, sem controle por ramal.** A divisão de vazão entre R-201 e R-202 fica livre, e com ela a carga orgânica de cada um | Processo / automação | Média |

Há ainda dois achados que não são da F02 Rev. A em si, mas que ela precisa registrar:
- **A4 (respiro 8" em PVC do as-built):** num reator selado ele é um caminho aberto para a atmosfera. Deve ser **tamponado** ou reaproveitado com função definida. Proponho registrar como nova LACUNA.
- **Ocupação dos bocais do tampo:** a configuração recomendada usa exatamente os 4 N1 (quadro na F02 Rev. B). Se o transbordo dedicado (D-RES-09, LAC-038) for adotado, ele precisa de bocal próprio. Candidato: um dos N3 2×2", sujeito à confirmação da Fibrais.

## 2. Premissas e números usados

| Grandeza | Valor | Origem |
|---|---|---|
| Alimentação | 7,22 m³/d (8% ST) | Bases §4 (referência, a recalcular na S1) |
| Volume útil / TRH | R-101 28,15 m³ / **3,9 d**; R-201 e R-202 85,06 m³ cada / **23,6 d** | Matriz S05/S06; cálculo |
| Pulso de transferência P-201 | 5 m³/h (referência). Com 6 pulsos/d por reator: 0,60 m³/pulso, 7,2 min, **0,7% do volume útil** | cálculo |
| Envelope dos reatores | +15/−8 mbar (R-101 −6); operação +1,5 a +3,5 | RES-001 REV03 |
| Sifão U de 500 mmCA | ≈ 51 mbar, **3,4×** o envelope | cálculo |
| Altura estática da P-201 | entrada pelo fundo ≈ 6,5 m; entrada pelo tampo ≈ 8,3 m | cálculo (nível do TQ-201 ≈ +1,0) |
| Energia extra da entrada pelo tampo | **≈ 0,1 kWh/d** (desprezível) | cálculo |
| Velocidade nas linhas a 5 m³/h | 6" ≈ 0,09 m/s; DN80 ≈ 0,33; DN65 ≈ 0,47; DN50 ≈ 0,67 m/s | cálculo (PEAD SDR11/17) |

A velocidade de autolimpeza para lodo de 4–8% ST fica na faixa de **0,6–0,9 m/s**. Abaixo
disso, a linha precisa de lavagem. Nenhuma linha de 6" atinge essa faixa nas vazões do processo.

## 3. Análise por disciplina

### 3.1 Processo
- **Dois estágios com neutralização intermediária:** coerente com o objeto FINEP e com o
  Formulário, que fala em "tanques de neutralização de pH". Manter.
- **Curto-circuito (F2):** com entrada e saída a +0,30 m, a fração de alimentação que sai sem
  residência depende só da mistura. O pulso é pequeno (0,7% do volume) e o efeito é limitado
  **se** o misturador estiver ligado durante o pulso. Recomendo duas medidas:
  - **intertravar o pulso com o misturador em operação;**
  - **alimentar pelo tampo**, com tubo de imersão até cerca de 1/3 da altura e saída pelo N2
    (fundo). Isso cria um caminho topo → fundo e resolve F1 e F2 juntos (seção 5).
- **Divisão entre R-201 e R-202 (F5):** alimentar em **pulsos alternados**, com uma válvula
  on-off falha-fechada por ramal (XV-211/XV-221) e volume por pulso totalizado no FQIT-201.
  Assim a carga de cada reator fica conhecida e ajustável, e o modo série (RL-04) passa a ser
  só uma questão de lógica, sem válvula extra.
- **Monitoramento térmico:** sem aquecimento (D5), a temperatura é a principal variável que o
  operador não controla e precisa acompanhar. Acrescentar **TIT por reator** (TIT-111/211/221).
- **Espuma (SP-06):** o misturador de topo ajuda. Deixar previsto um ponto de antiespumante.
  O detector de espuma pode ser decidido no HAZOP.

### 3.2 Segurança de processo
- **F1 (entrada de ar):** é a falha mais séria da Rev. A. A alça com quebra-vácuo atmosférico
  contraria o princípio da RES-001 (os reatores só trocam gás com o gasômetro). Há duas saídas:
  - **(a)** quebra-vácuo da alça ligado ao espaço de gás do próprio reator;
  - **(b) preferida:** eliminar a alça e alimentar pelo tampo com tubo de imersão furado acima
    do nível (quebra-sifão interno). Sem pressão hidrostática do reator na linha, não há
    retorno possível. É uma barreira **inerente, passiva**, e dispensa retenção em lodo.
- **F4 (sifonamento da coluna de saída):** desenhar a ligação do topo de cada coluna ao espaço
  de gás. No R-101 essa ligação se integra à equalização com o TQ-201 fechado.
- **Vácuo:** com a saída por gravidade, só a P-201 tira líquido de um vaso fechado, e ela
  aspira do TQ-201. Na C1, o TQ-201 fechado e equalizado repõe o volume com gás do R-101 e do
  gasômetro: ≈ 4,7 Nm³/h de ar equivalente a 5 m³/h, bem dentro do Q_máx de 20 m³/h. Os
  permissivos e trips da RES-001 §5.6 continuam valendo para a P-201.
- **Transbordo (LQ-01):** o tempo até o tampo a 5 m³/h é de cerca de 4 h no R-201/202 e 2 h no
  R-101. Mantêm-se o LSHH (SIF) e a decisão D-RES-09.
- **Grupo de explosão:** com o TQ-201 fechado e equalizado ao R-101, ele passa a ser IIC (gás
  com H₂), coerente com D-RES-10. O dispositivo e o equipamento de topo do TQ-201 entram no
  mesmo critério.

### 3.3 Hidráulica
- **Gravidade R-201/202 → TQ-301:** ΔH = 7,50 − 4,66 = 2,84 m, folga ampla. Não é a perda de
  carga que limita, e sim o **entupimento**: a 5 m³/h, uma linha de 6" anda a 0,09 m/s.
  Recomendações:
  - descida e sifão U em **DN80**, com declividade mínima de 2% nos trechos horizontais;
  - **tê de limpeza** com flange cego em cada mudança de direção;
  - **dreno no ponto baixo do U**;
  - **lavagem com água de serviço** depois de cada pulso, ou uma vez por dia.

  O volume morto da coluna de 7,2 m cai de 113 L (6") para 31 L (DN80).
- **Coluna de saída a partir do fundo:** tira o lodo mais denso e a areia, o que é bom. Por
  outro lado, não remove escuma. O misturador de topo resolve a escuma.
- **Saída do R-101 para o TQ-201 fechado e equalizado:** dispensa o sifão U (os dois espaços de
  gás estão à mesma pressão), e com isso some um ponto de entupimento.

### 3.4 Manutenção e operabilidade
- **R-101 é único:** o by-pass RL-03, via P-102 direto ao R-201/202, deve ser mantido. É a
  única forma de seguir operando com o R-101 parado, incluindo o período em que ele não pode
  operar por falta da garantia LAC-031.
- **Misturador de topo (D1):** o eixo de cerca de 9 m exige espaço de içamento acima do tampo
  (LAC-025). O pino de fundo proposto pela Fibrais fica na zona de areia, e trocá-lo exige
  esvaziar o reator (LAC-030). Recomendo pedir **eixo em balanço sem mancal de fundo**, ou um
  mancal substituível sem esvaziamento. Isso vira critério de aceitação da proposta.
- **Retenções em lodo fibroso** travam e vazam. A C1 tira as três retenções das entradas dos
  reatores, ficando só a da descarga da P-201, que é acessível no solo.
- **Selos hidráulicos:** reposição automática com LSL, água com glicol e inspeção semanal
  (LQ-02/LQ-03).
- **Válvulas no solo:** todas as válvulas operadas com frequência ficam ao nível do solo. No
  topo ficam só os isolamentos LO/LC, o selo e a emergência.

### 3.5 Instrumentação e automação

| Item | Rev. A | C1 |
|---|---|---|
| Válvulas on-off atuadas | 0 | **2** (XV-211, XV-221, falha-fechada) |
| Transmissores (PIT, LIT, AIT, AIC, FIT, TIT) | 11 | **15** (+TIT ×3, +FQIT) |
| I/O estimado da F02 | ≈ 14 | ≈ 24 |
| Intertravamentos | LSLL e PALL (RES-001) | + pulso × misturador em operação; + XV × PALL e LSHH do reator de destino |

O acréscimo de cerca de 10 I/O é pequeno frente ao total da planta (≈ 65 na Gen E), mas
precisa entrar na contagem da S7 e na LAC-026.

### 3.6 Estrutural e mecânico
- **Entrada pelo tampo** acrescenta um tubo de imersão interno, PRFV ou PP em DN80 com cerca de
  6 m no R-201/202, preso no bocal N1. A carga no tampo é pequena (ordem de 30–40 kg de tubo
  cheio, apoiado no flange), mas **entra na verificação SP-12 da Fibrais**. Pedir também a
  folga em relação às pás e às chicanas do misturador.
- **Colunas externas e linhas de subida** ficam em estrutura metálica independente, **sem
  carga horizontal no PRFV** (condição já posta para a ponte leve, D6).
- **TQ-201 fechado** precisa de envelope compatível com a Cascata B. O vaso de 3,6 m³ da
  Fibrais (Q10) deve ser verificado nas mesmas condições: +15/−6 mbar, como o R-101 ao qual
  fica ligado.

### 3.7 Ambiental, ocupacional e licenciamento
- **TQ-201 fechado** elimina a principal fonte difusa de H₂S da ilha 2 (NR-15, LAC-009) e reduz
  a área classificada no solo.
- **TQ-301 aberto** ainda emite o biogás residual do digestato (pós-digestão) e H₂S. Fica como
  **opção a avaliar**, fora da C1:
  - fechar o TQ-301 e ligá-lo ao coletor, recuperando gás e reduzindo emissão;
  - em contrapartida, ele entra no envelope de pressão, e hoje o desenho dele é "atmosférico".
  - Se ficar aberto: filtro de carvão no respiro de 12" e zona Ex definida na S4.

### 3.8 Contratual (FINEP)
- **4 bombas** (finalidade aprovada: recirculação de digestato e purga de lodo):
  - P-301 cumpre a recirculação (RL-05);
  - P-102 cumpre o by-pass e a recirculação do R-101 (RL-03/RL-07);
  - P-101 e P-201 são transferência.

  A C1 **não acrescenta bomba**: mantém a gravidade na descarga, sem P-202. A consulta sobre o
  enquadramento (LAC-008) continua necessária.
- **TQ-201:** a classificação como item "Tanques (3)" não muda com o fechamento.

## 4. Alternativas comparadas

- **C0 — Rev. A (Gen E como desenhada):** alimentação pelo N2 com alça e quebra-vácuo
  atmosférico; saída por coluna a partir do N2 e sifão U; TQ-201 aberto.
- **C1 — recomendada:**
  - alimentação pelo tampo (N1) com tubo de imersão;
  - saída por coluna a partir do N2, com quebra-sifão ligado ao espaço de gás;
  - TQ-201 fechado e equalizado com o R-101;
  - pulsos alternados por XV;
  - descida ao TQ-301 em DN80 com sifão U, limpeza e lavagem.
- **C2 — bombeada (estilo Rev10):** P-201 aspirando do R-101 e P-202 retirando dos
  metanogênicos sob controle de nível, com Q_máx e todas as barreiras da RES-001 §5.6.
- **C3 — neutralização em linha:** sem TQ-201; dosagem no barrilete da P-201 com misturador
  estático, e a P-201 aspirando do R-101.

| Critério | C0 | **C1** | C2 | C3 |
|---|---|---|---|---|
| Entrada de ar / O₂ | ✗ quebra-vácuo atmosférico | ✓ passivo | ✓ | ✓ |
| Vácuo por retirada (VC-03/09) | baixo | **baixo** | **alto** (retirada de dois reatores fechados; barreiras ativas) | médio (aspira do R-101) |
| Curto-circuito | ✗ entrada e saída a +0,30 | ✓ topo → fundo | depende do bocal | depende |
| H₂S no solo (NR-15) | ✗ TQ-201 aberto | ✓ | ✓ / ✗ (TQ-201 aberto?) | ✓ |
| Controle de carga R-201 / R-202 | ✗ livre | ✓ pulsos alternados | ✓ | ✓ |
| Flexibilidade de nível / TRH | fixo (coluna) | fixo (coluna) | **variável** | fixo / variável |
| Pontos de entupimento (sifões, retenções em lodo) | 3 U + 3 retenções | **2 U + 1 retenção** | 0 U + 3 retenções | 0 U + 2 retenções |
| Pulmão entre estágios | ✓ | ✓ | ✓ | ✗ (perde o tampão de pH) |
| Bombas | 2 + dosadora | 2 + dosadora | **3–4** + dosadora | 2 + dosadora |
| Válvulas atuadas | 0 | 2 | 3–5 | 2 |
| I/O (F02) | ≈ 14 | ≈ 24 | ≈ 35–40 | ≈ 22 |
| Tubulação externa vertical | alças (≈ 3 × 10–20 m) + colunas | colunas + subidas ao tampo | mínima | mínima |
| Intervenção nos vasos Fibrais | nenhuma | tubo de imersão em N1 (tampo existente) | bocais DN50/65/80 novos (LAC-039) | idem C2 no R-101 |
| Aderência FINEP | ✓ | ✓ | ✓ (5ª bomba vira contrapartida) | ✗ "tanques de neutralização" |
| CAPEX relativo | base | **≈ base** (+2 XV e instrumentos; −alças e retenções) | **++** | − |
| OPEX relativo (energia, manutenção) | médio (limpeza de U e alças) | **médio-baixo** | médio-alto | baixo |

**Ranking:** **C1** > C2 > C0 > C3.
- **C2** só ganha se o processo exigir nível e TRH variáveis nos metanogênicos. Hoje nada
  indica isso (TRH de 23,6 d com folga), e ela carrega o maior risco de vácuo e a maior
  dependência de barreiras ativas.
- **C3** perde o tampão de pH entre os estágios e a aderência ao Formulário FINEP.

## 5. Configuração recomendada (C1): o que muda na F02

1. **Alimentação pelo tampo.** Cada reator recebe pelo N1-A com tubo de imersão interno até
   cerca de 1/3 da altura. O furo quebra-sifão fica no espaço de gás. Alça, quebra-vácuo
   atmosférico e retenções da entrada saem.
2. **Saída por coluna externa a partir do N2-A**, com o topo ligado ao espaço de gás pelo
   N1-D (quebra-sifão):
   - R-101 → TQ-201 sem sifão U;
   - R-201/202 → TQ-301 com sifão U de 500 mmCA em DN80, dreno, tê de limpeza e lavagem.
3. **TQ-201 fechado**, com linha de **equalização** ao R-101 travada aberta (LO), em grupo IIC.
   O FCA-201 e o respiro atmosférico saem.
4. **P-201 com pulsos alternados:** XV-211 e XV-221 falha-fechada, FQIT-201 por pulso e
   intertravamento com o misturador do reator de destino em operação.
5. **TIT-111/211/221.**
6. **Quadro de alocação de bocais** na folha, incluindo **A4 tamponado**.

Ficam como estão: coletor de gás e RG-01, selos, emergência na M2, N₂ só para partida e purga,
expurgos N2-D com LC/KL, P-301 com expedição e RL-05, RL-07 e RL-03.

## 6. O que fica pendente

| Pendência | Quem fecha | Lacuna |
|---|---|---|
| Aceitar a C1 (substitui a D2 na forma de alimentação e o TQ-201 aberto) | RT / Diretoria | Ata D2 |
| Tubo de imersão no N1: carga no tampo (SP-12), folga para o misturador, material | Fibrais | LAC-031 / LAC-006 |
| Envelope do TQ-201 fechado (vaso Q10) | Fibrais | LAC-010 / LAC-031 |
| Diâmetros, perdas e lavagem das colunas e sifões | CSTR S1 | LAC-011 |
| A4 8" PVC: tamponar ou dar função | CSTR / Fibrais | **nova lacuna (propor)** |
| Bocal do transbordo dedicado, se adotado | CSTR / Fibrais | LAC-038 |
| Eixo do misturador em balanço ou mancal substituível sem esvaziar | Fibrais | LAC-030 |
| TQ-301 fechado com recuperação de gás (opção) | CSTR S1/S4 | LAC-012 + nova |
| I/O adicional (≈ +10) na contagem da S7 | CSTR S4/S7 | LAC-026 |

---
*Parecer de apoio à decisão, preparado com a skill `fluxograma-pid`. Os valores de processo são
de referência (Bases §4) e serão recalculados na S1. A revisão independente pelo Crivo A–F é
obrigatória antes de qualquer uso no projeto (CLAUDE.md §2.9).*
