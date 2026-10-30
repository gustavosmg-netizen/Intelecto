# Nota técnica — escoamento bifásico na saída dos metanogênicos

Polpa de 8% ST (plástico de Bingham) com biogás. Situação: **DOCUMENTO DE TRABALHO**. Reologia em hipótese (τy 5/30/100 Pa; LAC da reometria aberta) e números do modelo rev. 5.

## 1. A polpa guarda o gás

- **Critério de aprisionamento.** Uma bolha esférica fica presa num fluido com tensão de escoamento quando o número de Bingham Bn = τy/(ρ·g·R) passa de ≈ 0,143 (Tsamopoulos et al., 2008; Deoclecio et al., 2021). O raio limite é R = τy/(0,143·ρ·g):

| caso | τy (Pa) | bolhas retidas até R (cm) |
|---|---|---|
| otimista | 5 | 0,3 |
| central | 30 | 2,1 |
| pessimista | 100 | 6,9 |

- **Consequência.** Do caso central em diante, praticamente todas as bolhas formadas na massa (milimétricas) ficam presas na polpa em repouso e só saem com cisalhamento. Isso acontece no misturador e na queda, e também quando a polpa escoa e deixa de ser sólida. A polpa que transborda pelo N-SAI leva gás retido.
- **CH₄ dissolvido.** Há também metano dissolvido acima da saturação no digestato, medido em ≈ 6,8% de supersaturação (Tauber et al., 2019).
- **Quantidade.** Em volume de gás por dia, o arraste é pequeno diante da produção (pico da planta ≈ 27 Nm³/h). Com 1–5% v/v de gás retido, cada m³ de digestato leva 10–50 L de biogás. O valor real é a LAC-058.

## 2. O peso maior está no armazenamento

- **Medições de campo.** A estocagem aberta de digestato emite de ≈ 2,4% a 12% da produção de CH₄ da planta (Baldé et al., 2016; Vergote et al., 2020; Knoll et al., 2026).
- **Estocagem estanque.** Em 33 plantas, a estocagem estanque reduziu as emissões totais de 6,2% para 2,7% da produção (Wechselberger et al., 2024).
- **Consequência para o projeto.** Fechar o TQ-301 (alternativa B) ataca a maior parcela. Melhorar o selo (A′) não mexe nela.

## 3. Espuma

- **Causas.** A espuma em digestores aparece após choques de carga, com acúmulo de ácidos graxos, AGV, amônia e proteínas tensoativas (Ganidi et al., 2009; He et al., 2017; Yang et al., 2021; Krohn et al., 2025).
- **Efeitos.** Leva a perfil de sólidos invertido, com mais sólidos no topo (Pagilla et al., 1997).
- **No projeto.** O N-SAI no nível é o primeiro ponto a receber essa camada:
  - **A′:** espuma no copo derruba o fecho. Com fração de gás ε, o fecho vale 330·(1−ε) mm:

| fração de gás no copo | 0% | 20% | 50% | 80% |
|---|---|---|---|---|
| fecho (mbar) | 33 | 27 | 17 | 7 |

  - **B:** a espuma fica dentro do envelope de gás. É preciso uma sonda de espuma no TQ-301 para proteger o PVRV e a linha de gás.
- **Monitoramento.** O potencial de espuma é monitorável por ensaio de aeração padronizado (Jiang et al., 2018), base da LAC-059.

## 4. Sedimentação e pulsos

- **Pulsos.** A alimentação é por pulsos de 6 m³/h. Entre eles a saída para, e no caso pessimista a polpa é sólida abaixo de τy.
- **Onde a polpa fica parada:**
  - **A′:** copo, ânulo e fundo da CS-301, onde areia e crosta se acumulam.
  - **B:** só uma lâmina que escorre na rampa até esvaziar, porque sen θ = 0,54, 2,3× o mínimo pessimista.
- **Por que a rampa e não um tubo cheio.** A polpa para num tubo parcialmente cheio quando sen θ < τy/(ρ·g·0,304·D). Para o DE160, isso é 0,012 / 0,069 / 0,231 nos três casos. Um tubo cheio exigiria a carga de partida 4τyL/(ρgD), da ordem de 0,28 m por metro no caso pessimista. Por isso as soluções com U ou coluna cheia foram descartadas.

## 5. Regras de projeto que saem desta nota

1. **Saída:** sempre por transbordo no nível (N-SAI), com lâmina livre e sen θ ≥ 2× o mínimo pessimista. Nada de trecho cheio, sifão ou U na saída.
2. **Gás arrastado:** soltá-lo dentro de um espaço de gás recuperado, nunca num espaço ventilado à atmosfera.
3. **Selo hídrico em polpa que espuma:** não é barreira confiável. Se usado, precisa de vigilância de nível e de densidade.
4. **Tê de lavagem:** um no início de cada rampa, com água de serviço, para a partida e as paradas longas.

## Referências (Consensus)

- [Steady bubble rise and deformation in Newtonian and viscoplastic fluids and conditions for bubble entrapment](https://consensus.app/papers/details/9575558e90fd5ceb80df73560964e533/?utm_source=claude_desktop) Tsamopoulos, J. et al. (2008). J. Fluid Mech.
- [Bubble entrapment condition in Bingham materials](https://consensus.app/papers/details/07bb1b72620a566cb526e01576495c05/?utm_source=claude_desktop) Deoclecio, L. H. et al. (2021). J. Non-Newton. Fluid Mech.
- [Quantifying methane emissions from anaerobic digesters.](https://consensus.app/papers/details/c5a4d1d586255f0287f82ae80debf1d3/?utm_source=claude_desktop) Tauber, J. et al. (2019). Water Sci. Technol.
- [Methane emissions from digestate at an agricultural biogas plant.](https://consensus.app/papers/details/e7a6e428b5a6509a83193b128af3baa8/?utm_source=claude_desktop) Baldé, H. et al. (2016). Bioresour. Technol.
- [Monitoring methane and nitrous oxide emissions from digestate storage following manure mono-digestion](https://consensus.app/papers/details/078ca65745b75c1e8c2c2f699d9afe61/?utm_source=claude_desktop) Vergote, T. et al. (2020). Biosyst. Eng.
- [Novel monitoring approach for seasonally resolved continuous methane emission measurements from open digestate storage](https://consensus.app/papers/details/0dce95970afe5be0afe41eed1dc234c1/?utm_source=claude_desktop) Knoll, L. et al. (2026). Biomass Futures.
- [Assessment of whole-site methane emissions from anaerobic digestion plants](https://consensus.app/papers/details/b56aa31a79af5c5d921d862be7b7941e/?utm_source=claude_desktop) Wechselberger, V. et al. (2024). Waste Manage.
- [Anaerobic digestion foaming causes--a review.](https://consensus.app/papers/details/8579605ab48e51cb906cbdc6f632eccc/?utm_source=claude_desktop) Ganidi, N. et al. (2009). Bioresour. Technol.
- [Investigation of foaming causes in three mesophilic food waste digesters](https://consensus.app/papers/details/10f706911d0e5a15912b6a90b88f12d3/?utm_source=claude_desktop) He, Q.-M. et al. (2017). Sci. Rep.
- [Foaming mechanisms and control strategies during the anaerobic digestion of organic waste](https://consensus.app/papers/details/c76d73a7c5e25b1096ce5a731abe9f19/?utm_source=claude_desktop) Yang, P. et al. (2021). Sci. Total Environ.
- [Microbial population shifts during disturbance induced foaming](https://consensus.app/papers/details/4bed29195d795913b094dbb4f22418ea/?utm_source=claude_desktop) Krohn, C. et al. (2025). Water Res.
- [Causes and effects of foaming in anaerobic sludge digesters](https://consensus.app/papers/details/5b3305f374005a39b4a899939ac812da/?utm_source=claude_desktop) Pagilla, K. et al. (1997). Water Sci. Technol.
- [Monitoring foaming potential in anaerobic digesters.](https://consensus.app/papers/details/014cc6f0d14e51859202452c84ec82d4/?utm_source=claude_desktop) Jiang, C. et al. (2018). Waste Manage.
