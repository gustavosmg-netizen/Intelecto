# Nota técnica — escoamento bifásico na saída dos metanogênicos

Polpa de 8% ST (plástico de Bingham) com biogás. Situação: **DOCUMENTO DE TRABALHO**, revisado pelo Crivo A–F. Reologia em hipótese (τy 5/30/100 Pa) até a reometria (LAC-041). Números do modelo rev. 5.

## 1. A polpa guarda o gás

**Critério de aprisionamento.** Uma bolha esférica fica presa num fluido com tensão de escoamento quando Bn = τy/(ρ·g·R) passa de ≈ 0,143 (Tsamopoulos et al., 2008; Deoclecio et al., 2021). O raio limite é R = τy/(0,143·ρ·g):

| caso | τy (Pa) | bolhas retidas até R (cm) |
|---|---|---|
| otimista | 5 | 0,3 |
| central | 30 | 2,1 |
| pessimista | 100 | 6,9 |

**Consequência.** Do caso central em diante, quase todas as bolhas formadas na massa (milimétricas) ficam presas na polpa em repouso. Elas só saem com cisalhamento: no misturador, na queda e no escoamento, quando a polpa deixa de se comportar como sólido. A polpa que transborda pelo N-SAI leva gás retido.

**CH₄ dissolvido.** Em digestores de ETE, Tauber et al. (2019) mediram o metano dissolvido no digestato acima da concentração de equilíbrio com o biogás. Para polpa agroindustrial esse valor é LAC-058.

**Quantidade.** Em volume, o arraste é pequeno diante da produção da planta (pico ≈ 27 Nm³/h). Na hipótese de 1–5% v/v de gás retido, cada m³ de digestato leva 10–50 L de biogás. O valor real é LAC-058.

## 2. Armazenamento do digestato

**Medições de campo.** A estocagem aberta de digestato emite parcela relevante do CH₄ da planta:
- Baldé et al. (2016) e Vergote et al. (2020) mediram em tanques agrícolas de longa retenção;
- Knoll et al. (2026) acompanharam ao longo das estações uma estocagem aberta.
- A faixa citada nesses trabalhos vai de alguns porcento a ≈ 12% da produção, com o extremo alto no verão e em longa retenção.

**Estocagem estanque.** Num levantamento de plantas, as que tinham estocagem estanque emitiram 2,7% da produção, contra 6,2% das que não tinham (Wechselberger et al., 2024).

**Para o projeto.** O TQ-301 é um pulmão curto, com ≈ 17 m³ úteis. A parcela que fechar o TQ-301 (alternativa B) recupera depende do potencial residual na temperatura e no tempo de residência dele (LAC-058). A melhoria do selo (A′) não mexe nessa parcela.

## 3. Espuma

**Causas.** A espuma em digestores aparece após choques de carga, com acúmulo de ácidos graxos, AGV, amônia e proteínas tensoativas (Ganidi et al., 2009; He et al., 2017; Yang et al., 2021; Krohn et al., 2025). Ela leva a um perfil de sólidos invertido, com mais sólidos no topo (Pagilla et al., 1997).

**No projeto.** O N-SAI no nível é o primeiro ponto a receber essa camada.

**A′.** A espuma no copo derruba o fecho. Com fração de gás ε, o fecho vale 330·(1−ε) mm:

| fração de gás no copo | 0% | 20% | 50% | 80% |
|---|---|---|---|---|
| fecho (mbar) | 33 | 27 | 17 | 7 |

**B.** A espuma fica dentro do envelope de gás. É preciso uma sonda de espuma no TQ-301 para proteger o PVRV e a LE-301. O único selo, SO-301 (emergência), é dimensionado com 50% de espuma.

**Ensaio.** O potencial de espuma é monitorável por ensaio de aeração padronizado (Jiang et al., 2018), base da LAC-059.

## 4. Sedimentação e pulsos

A alimentação é por pulsos de 6 m³/h. Entre eles a saída para, e no caso pessimista a polpa se comporta como sólido abaixo de τy.

**Onde a polpa fica parada:**
- **A′:** copo, ânulo e fundo da CS-301, onde se acumulam areia e crosta.
- **B:** fundo do TQ-301 e uma lâmina na rampa, de raio hidráulico τy/(ρ·g·sen θ) ≈ 18 mm no caso pessimista; o tê de lavagem a remove.

**Por que rampa e não tubo cheio.** A polpa para num tubo parcialmente cheio quando sen θ < τy/(ρ·g·0,304·D). Para o DE160, isso dá 0,012 / 0,069 / 0,231 nos três casos. Um tubo cheio exige a carga de partida 4τyL/(ρgD), ≈ 0,28 m por metro no caso pessimista. Por isso as soluções com U ou coluna cheia foram descartadas.

## 5. Regras de projeto que saem desta nota

1. **Saída.** Por transbordo no nível (N-SAI), com lâmina livre e sen θ ≥ 2× o mínimo pessimista. Nada de trecho cheio, sifão ou U.
2. **Bocal afogado.** O N-SAI trabalha afogado no pulso. O espaço de gás a jusante precisa de caminho próprio de equalização: o respiro RS na A′ ou a LE-301 na B.
3. **Gás arrastado.** Soltá-lo num espaço de gás recuperado, não num espaço ventilado à atmosfera.
4. **Selo em polpa que espuma.** Não serve como barreira de operação. Se for usado, precisa de vigilância de nível e de densidade. Como barreira de emergência, deve ser dimensionado com espuma.
5. **Lavagem.** Prever um tê de lavagem no início de cada rampa, com água de serviço, para a partida e as paradas longas.

## Referências (Consensus)

- [Steady bubble rise and deformation in Newtonian and viscoplastic fluids and conditions for bubble entrapment](https://consensus.app/papers/details/9575558e90fd5ceb80df73560964e533/) Tsamopoulos, J. et al. (2008). J. Fluid Mech.
- [Bubble entrapment condition in Bingham materials](https://consensus.app/papers/details/07bb1b72620a566cb526e01576495c05/) Deoclecio, L. H. et al. (2021). J. Non-Newton. Fluid Mech.
- [Quantifying methane emissions from anaerobic digesters](https://consensus.app/papers/details/c5a4d1d586255f0287f82ae80debf1d3/) Tauber, J. et al. (2019). Water Sci. Technol.
- [Methane emissions from digestate at an agricultural biogas plant](https://consensus.app/papers/details/e7a6e428b5a6509a83193b128af3baa8/) Baldé, H. et al. (2016). Bioresour. Technol.
- [Monitoring methane and nitrous oxide emissions from digestate storage following manure mono-digestion](https://consensus.app/papers/details/078ca65745b75c1e8c2c2f699d9afe61/) Vergote, T. et al. (2020). Biosyst. Eng.
- [Novel monitoring approach for seasonally resolved continuous methane emission measurements from open digestate storage](https://consensus.app/papers/details/0dce95970afe5be0afe41eed1dc234c1/) Knoll, L. et al. (2026). Biomass Futures.
- [Assessment of whole-site methane emissions from anaerobic digestion plants](https://consensus.app/papers/details/b56aa31a79af5c5d921d862be7b7941e/) Wechselberger, V. et al. (2024). Waste Manage.
- [Anaerobic digestion foaming causes — a review](https://consensus.app/papers/details/8579605ab48e51cb906cbdc6f632eccc/) Ganidi, N. et al. (2009). Bioresour. Technol.
- [Investigation of foaming causes in three mesophilic food waste digesters](https://consensus.app/papers/details/10f706911d0e5a15912b6a90b88f12d3/) He, Q.-M. et al. (2017). Sci. Rep.
- [Foaming mechanisms and control strategies during the anaerobic digestion of organic waste](https://consensus.app/papers/details/c76d73a7c5e25b1096ce5a731abe9f19/) Yang, P. et al. (2021). Sci. Total Environ.
- [Microbial population shifts during disturbance induced foaming](https://consensus.app/papers/details/4bed29195d795913b094dbb4f22418ea/) Krohn, C. et al. (2025). Water Res.
- [Causes and effects of foaming in anaerobic sludge digesters](https://consensus.app/papers/details/5b3305f374005a39b4a899939ac812da/) Pagilla, K. et al. (1997). Water Sci. Technol.
- [Monitoring foaming potential in anaerobic digesters](https://consensus.app/papers/details/014cc6f0d14e51859202452c84ec82d4/) Jiang, C. et al. (2018). Waste Manage.
