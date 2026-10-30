# Parecer técnico — Configuração da F02 (cascata anaeróbia) · REV01

| Campo | Registro |
|---|---|
| Projeto | ThermoBiogasUp · CSTR / FINEP 0786/23 · alternativa **Gen E** |
| Objeto | P&ID TBU-GENE-PID-F02 e a interface com o lado de gás |
| Pergunta da REV01 | **É possível suprimir o TQ-201?** Um tanque externo ao acidogênico que recebe o efluente com H₂S exige linha de gás, vedação, seguranças e misturador próprios. Sem ele, o sistema ainda atende a todos os cenários de pressão e vácuo? |
| Base | `PROJETO_EXECUTIVO_OFICIAL`: CLAUDE.md Rev01-A (D1–D6), Bases e Critérios REV00, Matriz S0, Registro de Lacunas (40), RES-001 REV03, minuta ATA-DIR-CSTR-001 |
| Natureza | **Parecer de engenharia, não emitido pelo projeto.** Sem valores monetários: custos em quantitativos e custo relativo. Exige o Crivo A–F antes de qualquer uso (CLAUDE.md §2.9) |
| Revisões | REV00 (30/10/2026): recomendava a C1 (TQ-201 fechado e equalizado). **REV01 (30/10/2026): passa a recomendar a C4 (sem TQ-201)**, pelos motivos da seção 1 |

## 1. Conclusão

**Sim. O TQ-201 pode ser suprimido e o sistema continua atendendo a todos os cenários da
RES-001 REV03**, com as condições da seção 5. A supressão é, além disso, **a melhor configuração
técnica** entre as estudadas. Chamo-a de **C4**.

O motivo central é físico. Sem o TQ-201, a P-201 transfere líquido **de um vaso fechado (R-101)
para outro vaso fechado (R-201 ou R-202) ligados ao mesmo coletor de gás**. O volume que sai de
um é o mesmo que entra no outro, então o gás deslocado no metanogênico volta ao R-101 pelo
coletor. A transferência é **neutra em gás**: não depende do gasômetro, não admite ar e não
emite H₂S.

O TQ-201 só existia para dar um pulmão atmosférico entre os estágios. Fechado (C1), ele virava
um quarto vaso no envelope de pressão, com equalização, grupo IIC e misturador próprio, que é
justamente o que se quer evitar.

| O que sai com o TQ-201 | O que entra no lugar |
|---|---|
| Tanque de 2,5–3,6 m³ (PRFV, envelope de pressão, base, bacia) | Misturador estático MS-201 em linha |
| Misturador AG-200 (motor Ex IIC) | Controle de nível LIC-111 no R-101 (a P-201 trabalha por nível) |
| Linha de equalização TQ-201 ↔ R-101 e seu bocal | Permissivos e trips da RES-001 §5.6 aplicados à P-201 |
| Coluna de saída do R-101 e quebra-sifão | Sucção reserva para a P-102 no R-101 (N2-C, LC) |
| Exposição a H₂S no solo (NR-15) e respiro com carvão | — |
| LIT-201 e a bolha do tanque | ZSO-115, LSLL-111 e PSL-201 (sensores dedicados às SIF) |

**O que se perde, e como se compensa:**

1. **O pulmão entre os estágios.** Com pulsos de 0,6 m³, o nível do R-101 oscila cerca de
   7,5 cm por pulso, num volume útil de 28 m³. É desprezível para o TRH.
2. **O tanque de neutralização** previsto no Formulário FINEP. A função passa a ser feita em
   linha. A aderência formal precisa ir à consulta FINEP (LAC-008/010).
3. **Uma camada de amortecimento contra pulso ácido no metanogênico.** Compensa-se assim:
   - cada pulso é 0,7% do volume de um reator com alcalinidade própria;
   - o pH do R-101 (AIT-111) entra em antecipação e o AIC-201 corrige a jusante;
   - a DOS-201 só dosa se for preciso;
   - acompanhamento de FOS/TAC por análise de bancada.

## 2. Números usados

| Grandeza | Valor | Origem |
|---|---|---|
| Alimentação | 7,22 m³/d (8% ST) | Bases §4 (referência, a recalcular na S1) |
| Volume útil / TRH | R-101 28,15 m³ / 3,9 d; R-201 e R-202 85,06 m³ cada / 23,6 d | Matriz S05/S06 |
| Espaço de vapor | R-101 9,65 m³; R-201/202 20,41 m³ | RES-001 §4 |
| Envelope / selo / emergência | R-201/202: +15/−8, selo +8/−3, emergência +12/−6. R-101: +15/−6, selo −2/−3, emergência −4/−5 (mbar) | RES-001 §3 |
| Pulso da P-201 | 5 m³/h de referência (Q_máx proposto de 20 m³/h). Com 6 pulsos/d por reator: 0,6 m³ e 7,2 min | cálculo |
| Altura estática da P-201 | ≈ 6,0 m (nível do R-101 ≈ +3,3 até o tampo do R-201 a +9,32) + misturador estático + atrito | cálculo |
| Gás deslocado na transferência | 4,7 Nm³/h de ar equivalente a 5 m³/h; 18,6 a 20 m³/h. Perda no coletor ≈ 0,006 e 0,07 mbar/100 m | cálculo (RES-001 §5.6) |

## 3. Verificação de pressão e vácuo na C4, cenário a cenário

Os IDs são os da RES-001 REV03. "Igual" quer dizer que a supressão do TQ-201 não muda o
cenário.

### 3.1 Sobrepressão

| ID | O que muda na C4 | Verificação | Resultado |
|---|---|---|---|
| SP-01 | igual | Saída de gás do reator bloqueada → selo. Ramal LO | ✓ |
| SP-02 | **Agrava se houver CO₂ da neutralização.** Com NaHCO₃ e AGV de 2–6 g/L, o pulso de 5 m³/h libera **3,7–11 Nm³/h** de CO₂ dentro do metanogênico. Somado ao pico de 25,5 Nm³/h, passa dos 27 Nm³/h do selo | **PAHH (+6) desliga a P-201 e a DOS-201** (acrescentado à SIF "PAHH → alimentação"). Com o pulso parado, volta o SP-02 original (≤ 27) | ✓ **com a condição** |
| SP-03 | igual | Gasômetro | ✓ |
| SP-04 | **Melhora.** A P-201 descarregando no R-201 com a saída obstruída sobe o nível. O gás deslocado volta ao R-101 pelo coletor (neutro) e não pressuriza o sistema | LSHH do destino desliga a P-201 | ✓ |
| SP-05 a SP-08 | iguais | N₂, espuma, incêndio, deflagração: sem relação com o TQ-201 | ✓ |
| SP-09, SP-10, SP-12, SP-13 | iguais | Lado de gás e cargas no tampo | ✓ |
| SP-11 | igual | TSHH da alimentação (F01) | ✓ |

### 3.2 Vácuo

| ID | O que muda na C4 | Verificação | Resultado |
|---|---|---|---|
| VC-01, VC-02, VC-07 | iguais | Gasômetro e selo | ✓ |
| VC-03 (retirada com gás ligado) | **Muda de natureza.** A P-201 retira do R-101, mas a mesma vazão entra no metanogênico. O R-101 recebe de volta o gás deslocado pelo coletor: 4,7 Nm³/h a 5 m³/h, com perda de ≈ 0,006 mbar/100 m. **Não depende do gasômetro** enquanto os dois ramais estiverem abertos | Permissivo ZSO-115 (gás do R-101 ligado) e XV do destino aberta. Uma retirada por vez | ✓ |
| VC-04 | igual | Sopradores só a partir do gasômetro; PALL e LSLL hardwired | ✓ |
| VC-05, VC-06 | iguais | Emergência na M2 | ✓ |
| VC-08 | **Muda.** Com dosagem em linha, a absorção de CO₂ acontece no metanogênico. Com NaHCO₃ não há absorção (libera CO₂, ver SP-02). Com NaOH em excesso haveria leve tendência a vácuo | **Especificar NaHCO₃** (ou carbonato) e limitar a dose pelo AIC-201. Proibir NaOH sem limitador | ✓ com a condição |
| **VC-09** (P-201 com o gás do R-101 isolado) | **Principal cenário da C4.** Sem reposição de gás, a 5 m³/h o R-101 vai de +2,5 a 0 mbar (PALL) em **≈ 17 s**, o selo abre em −2 mbar ≈ 14 s depois e admite ar. Sem selo, chegaria ao envelope de −6 em mais ≈ 41 s. A 20 m³/h, esses tempos caem para 4 s, 3 s e 10 s | **Três barreiras independentes:** (1) permissivo e trip pela **ZSO-115** (ramal de gás do R-101 aberto); (2) trip pelo **PALL do R-101**, hardwired, que atua em segundos; (3) selo com capacidade ≥ 2 × Q_máx. Recomendo **limitar a P-201 a 5 m³/h**, e não 20, para ganhar tempo de resposta | ✓ com as condições |
| VC-10 | igual | PSV na descarga da bomba volumétrica | ✓ |
| VC-11 (sucção entupida) | **Passa a existir no R-101.** O vácuo fica na linha de sucção, não no espaço de gás | **PSL-201** na sucção, com trip; sucção resistente a vácuo | ✓ |

### 3.3 Líquido e operações

| ID | O que muda na C4 | Verificação | Resultado |
|---|---|---|---|
| LQ-01 (transbordo) | **R-101:** sem saída por transbordo, o nível depende da P-201. Com a P-201 parada e a P-101 ligada, o tampo é alcançado em ≈ 2 h a 5 m³/h | **LSHH-111 dedicado desliga a P-101** (SIF). O N1-D do R-101 fica reservado para o transbordo dedicado (D-RES-09 / LAC-038) | ✓ |
| LQ-01 (R-201/202) | igual (≈ 4 h a 5 m³/h) | LSHH do destino desliga a P-201 | ✓ |
| LQ-02, LQ-03 | iguais | Selo com LSL e glicol | ✓ |
| LQ-04 | **Melhora.** Some o sifão U do primeiro estágio; o U fica só na descida ao TQ-301 | — | ✓ |
| Nível baixo no R-101 | Novo: a P-201 pode esvaziar o R-101 abaixo do mínimo do misturador | **LSLL-111 dedicado** desliga a P-201 e o misturador AG-R101 | ✓ |
| OP-01 a OP-05 | iguais | — | ✓ |

**Síntese.** Nenhum cenário passa a não ter atendimento. Quatro passam a exigir condições
explícitas, todas de baixo custo:
- **SP-02:** PAHH desliga a P-201 e a DOS-201.
- **VC-08:** alcalinizante NaHCO₃ com limite de dose.
- **VC-09:** ZSO-115, PALL do R-101 e P-201 limitada a 5 m³/h.
- **VC-11 e LQ:** PSL-201, LSHH-111 e LSLL-111 dedicados.

## 4. Demais disciplinas

### 4.1 Processo
- **Neutralização sob demanda.** Ela pode nem ser necessária no regime normal, porque o
  metanogênico tamponado absorve um pulso de 0,7% do volume. Por isso a DOS-201 fica em espera,
  comandada pelo AIC-201 (pH a jusante do MS-201), com o AIT-111 (pH do R-101) em antecipação.
- **Recirculação de digestato (RL-05) como agente alcalino.** É possível e atende à finalidade
  FINEP das bombas, mas **dilui o 2º estágio**: com 15% de recirculação o TRH dos metanogênicos
  cai de 23,6 para 20,5 d; com 30%, para 18,1 d. Num reator sem aquecimento (15–35 °C), isso pede
  cautela. Fica como opção limitada, sob decisão da S1.
- **O R-101 passa a ter nível controlado (LIC-111)** em vez de transbordo. A banda de nível
  (por exemplo, +3,30 a +3,50 m) é decisão da S1 (LAC-005).
- **Mantidos da REV00:**
  - alimentação dos três reatores **pelo tampo**, com tubo de imersão (topo → fundo, sem
    curto-circuito, sem retorno, sem alça, sem retenção em lodo);
  - pulsos alternados por XV-211 e XV-221 com FQIT-201;
  - TIT por reator;
  - pulso só com o misturador do destino em operação.

### 4.2 Segurança e ocupacional
- **H₂S:** some a única fonte difusa de H₂S no solo da ilha 2. Todo o gás do R-101 segue pelo
  coletor ao tratamento. Com isso, o F-201 passa a receber esse H₂S, que o TQ-201 aberto
  liberava; o balanço de enxofre (LAC-014) precisa considerar isso.
- **Área classificada:** encolhe, porque somem o respiro e o misturador do TQ-201.
- **Grupo de explosão:** inalterado (IIC no topo dos reatores, D-RES-10).
- **Sensores dedicados por SIF** (RES-001 §5.6, LAC-035): ZSO-115, LSLL-111, LSHH-111, PSL-201,
  separados do LIC-111 e do PIT-111 de controle.

### 4.3 Hidráulica
- **Altura manométrica da P-201** ≈ 6 m estáticos + misturador estático + atrito, da ordem de
  1–1,5 bar. Trivial para bomba volumétrica.
- **NPSH:** folgado, porque a sucção fica afogada por cerca de 3 m de lodo mais a pressão do
  espaço de gás.
- **Sucção pelo N2 (+0,30 m) aspira areia:** prever coletor de pedras ou caixa de areia na
  sucção, com dreno, e bomba resistente a abrasão (S8).
- **Mantidos:** descida R-201/202 → TQ-301 por gravidade com sifão U em DN80, dreno, tê de
  limpeza e lavagem; colunas com quebra-sifão ligado ao espaço de gás.

### 4.4 Manutenção e disponibilidade
- **A P-201 vira ponto único do 2º estágio.** A C4 o resolve com a **P-102 como reserva
  instalada**: ela aspira do R-101 pelo N2-C (LC) e descarrega no barrilete (RL-07). Não é
  preciso comprar outra bomba.
- **R-101 parado** (por exemplo, até fechar a LAC-031): o by-pass RL-03 (P-102 direto do TQ-101)
  continua alimentando os metanogênicos.
- **Misturador estático:** sem partes móveis, com flanges para retirada e lavagem.
- **Pontos de manutenção a menos:** somem um tanque, um misturador, um respiro com filtro, um
  sifão U e uma coluna.

### 4.5 Automação

| Item | C1 (REV00) | **C4** |
|---|---|---|
| Transmissores e analisadores | 15 | 14 (−LIT-201; LIT-111 vira LIC-111) |
| Chaves dedicadas às SIF | — | +3 (LSLL-111, PSL-201, ZSO-115) |
| Válvulas atuadas | 2 | 2 |
| I/O estimado da F02 | ≈ 24 | ≈ 24 |

A lógica fica mais exigente (controle de nível do R-101 por pulsos), mas é padrão.

### 4.6 Estrutural e civil
- **Saem:** a base do TQ-201, sua parte da bacia, a coluna de saída do R-101 e o suporte da
  linha de equalização.
- **Ficam:** as subidas externas ao tampo, apoiadas em estrutura independente, sem carga
  horizontal no PRFV.
- **Tubo de imersão:** a carga no tampo continua na verificação SP-12 da Fibrais.

### 4.7 Contratual (FINEP)
- **"Tanques (3)":** o TQ-201 era um dos três. Sem ele, ficam o TQ-101 e o TQ-301, e este com a
  rubrica em conciliação (LAC-012). **É preciso conferir com a FINEP** se a rubrica comporta a
  troca do tanque de neutralização por neutralização em linha (Formulário: "tanques de
  neutralização de pH").
- **Alternativa para manter a aderência:** um **tanque de preparo da solução alcalina**,
  atmosférico e sem H₂S, alimentando a DOS-201. Atenção: o "tanque de produto químico" foi
  **excluído formalmente** (D8), então esse tanque seria contrapartida. Deixo para decisão da
  Diretoria (LAC-008/010).
- **Bombas (4):** P-101, P-102 (reserva e recirculação), P-201 e P-301, sem bomba nova. A
  bomba dosadora segue coberta.

### 4.8 Ambiental
- Some a emissão difusa de H₂S e de CO₂ do TQ-201.
- O TQ-301 aberto continua como fonte residual. A opção de fechá-lo, mantida da REV00, fica para
  a S1/S4.

## 5. Condições para adotar a C4

1. **SIF e intertravamentos**, a levar ao HAZOP/LOPA:
   - PAHH do reator desliga P-201 e DOS-201;
   - PALL do R-101 desliga a P-201;
   - ZSO-115 é permissivo e trip da P-201;
   - LSLL-111 desliga P-201 e AG-R101;
   - LSHH-111 desliga a P-101;
   - LSHH do destino desliga a P-201;
   - PSL-201 desliga a P-201.

   Cada uma com sensor dedicado.
2. **P-201 limitada a 5 m³/h** (bomba volumétrica dimensionada para isso, inversor travado).
   Fica abaixo do Q_máx de 20 m³/h, para dar tempo de resposta no VC-09.
3. **Alcalinizante NaHCO₃** (ou carbonato), com dose limitada pelo AIC-201. NaOH, só com limitador.
4. **Coletor de pedras na sucção** da P-201 e da P-102.
5. **Consulta FINEP** sobre o tanque de neutralização (LAC-008/010).
6. **Balanço de enxofre** (LAC-014) incluindo o H₂S que antes saía no TQ-201.

## 6. Alternativas comparadas

- **C0:** Rev. A (alça com quebra-vácuo atmosférico, TQ-201 aberto).
- **C1:** REV00 (TQ-201 fechado e equalizado).
- **C2:** tudo bombeado (P-201 do R-101 e P-202 dos metanogênicos, sem gravidade).
- **C4:** recomendada (sem TQ-201, transferência direta neutra em gás, neutralização em linha).

| Critério | C0 | C1 | C2 | **C4** |
|---|---|---|---|---|
| Entrada de ar | ✗ | ✓ | ✓ | ✓ |
| H₂S no solo | ✗ | ✓ | ✓ | ✓ |
| Vasos no envelope de pressão | 3 | **4** | 3 | **3** |
| Vácuo por retirada | baixo | médio (TQ-201 equalizado) | alto (2 reatores retirados) | médio (só R-101, transferência neutra) |
| Pulmão entre estágios | ✓ | ✓ | ✗ | ✗ (oscilação de 7,5 cm/pulso) |
| Misturadores | 4 | 4 | 3 | **3** |
| Tanques novos | 1 | 1 | 0 | **0** |
| Bombas | 2 + dos. | 2 + dos. | 3–4 + dos. | **2 + dos.** (P-102 reserva) |
| Linhas de gás adicionais | 0 | 1 (equalização) | 0 | **0** |
| I/O da F02 | ≈ 14 | ≈ 24 | ≈ 35–40 | ≈ 24 |
| Aderência ao "tanque de neutralização" | ✓ | ✓ | ✓ | **a consultar** |
| CAPEX relativo | base | base | ++ | **−** (sem tanque, misturador, base) |
| OPEX relativo | médio | médio-baixo | médio-alto | **baixo** |

**Ranking: C4 > C1 > C2 > C0.**
- **C1** só volta a ser preferível se a FINEP exigir um tanque físico de neutralização. Mesmo
  assim, a alternativa do tanque de solução alcalina (seção 4.7) mantém a C4.

## 7. O que muda na F02 (Rev. C)

1. **TQ-201 eliminado,** com AG-200, FCA-201, linha de equalização e coluna de saída do R-101.
2. **P-201 aspira do R-101 pelo N2-A** e descarrega no barrilete por VR-201 e MS-201, com
   pulsos alternados por XV-211 e XV-221.
3. **DOS-201 injeta a montante do MS-201,** com AIC-201 a jusante e AIT-111 em antecipação.
   RL-05 opcional na mesma tomada.
4. **R-101 com LIC-111,** e com ZSO-115, LSLL-111, PSL-201 e TIT-111.
5. **P-102 como reserva instalada** pelo N2-C do R-101 (LC), com o mesmo barrilete pela RL-07.
6. **Quadro de bocais refeito por reator:** no R-101, o N1-D fica reservado ao transbordo
   dedicado.

## 8. Pendências

| Pendência | Quem fecha | Lacuna |
|---|---|---|
| Aceitar a C4 (altera a D2: sem TQ-201) | RT / Diretoria | Ata D2 |
| Enquadramento FINEP sem tanque de neutralização | Diretoria / FINEP | LAC-008 / LAC-010 |
| Banda de nível do R-101 (LIC-111) e níveis dos metanogênicos | CSTR S1 | LAC-005 |
| Balanço ácido-base (AGV, alcalinidade) e de enxofre com o H₂S retido | CSTR S1 | LAC-009 / LAC-014 |
| SIF da seção 5 no HAZOP/LOPA, com sensores dedicados | CSTR S4 | LAC-026 / LAC-035 |
| Tubo de imersão no tampo (SP-12) e garantia do envelope | Fibrais | LAC-031 |
| Bocais N2 do R-101: sucção da P-201 e reserva da P-102 | CSTR / Fibrais | LAC-006 / LAC-039 |
| A4 8" PVC: tamponar | CSTR / Fibrais | **nova lacuna (propor)** |

---
*Parecer de apoio à decisão, preparado com a skill `fluxograma-pid`. Os valores de processo são
de referência (Bases §4) e serão recalculados na S1.*
