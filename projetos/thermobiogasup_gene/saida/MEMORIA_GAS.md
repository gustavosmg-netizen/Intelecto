# Memória do sistema de biogás — Gen E rev. 4 (documento de trabalho)

Situação: **PROPOSTA DE TRABALHO, NÃO LIBERADA**, sujeita ao Crivo A–F independente. Pressões em mbar manométricos no sítio de referência (Congonhas/MG, ≈ 870 m). Sem valores monetários.

## 1. Arquitetura e regras de operação

O sistema tem dois níveis de pressão, e os reatores ficam praticamente sem pressão positiva ou negativa:

1. **Reatores → GH-1 (gasômetro de membrana simples, ≈ 0 a +2 mbar).**
   - Cada reator sai pelo N3 com registro LO e ZSC, desce a um pote de condensado no chão e entra no coletor COL-501, que vai aos dois gasômetros GH-1A e GH-1B.
   - O coletor **não tem retenção**: o reator respira com o GH-1 que está recebendo, para entregar gás e também para receber de volta quando esfria ou quando se retira líquido.
2. **Alternância GH-1A / GH-1B.** Em cada instante uma bolsa **RECEBE** (entrada aberta, saída fechada) e a outra **TRANSFERE** (entrada fechada, saída aberta).
   - A saída é uma linha exclusiva, com XV falha-fecha e **retenção anti-retorno**, até os sopradores S-501.
   - A saída de uma bolsa só abre com a entrada dela comprovadamente fechada (ZSC) e a entrada da outra comprovadamente aberta (ZSO).
   - **Entrada de uma bolsa só abre** com a saída dela fechada (ZSC) e o S-501 parado.
   - **Saídas:** válvula de bloqueio estanque (classe VI) + retenção de sede macia. Elas fecham em **qualquer** parada do S-501 e em toda falha de sequência (posição não confirmada no tempo).
   - **Entradas são falha-abre** e as saídas falha-fecha: na perda de ar ou de energia, as duas bolsas passam a receber e nenhuma transfere. Assim o reator sempre tem para onde empurrar o gás e nada aspira o coletor.
   - **Bolsa que recebe cheia (LSHH) com a outra ainda transferindo:**
     1. parte o S-501B (ou ambos), porque a transferência já é mais rápida que o enchimento;
     2. se a bolsa que recebe chegar ao LAHH, a transferência para, as saídas fecham e as duas bolsas passam a receber;
     3. o excesso sai pelo alívio conduzido do GH-1, a ≤ +5 mbar.
3. **S-501 → GH-2 (dupla membrana, pressão de consumo) → flare e consumidores.**
   - Os sopradores só aspiram a bolsa que está transferindo. **Nenhum soprador aspira o coletor dos reatores.**
   - Camada mecânica (RES-001 D-RES-12): a válvula autoatuada PCV-501 mantém a pressão a montante, na bolsa, em ≈ +0,3 mbar.
   - Trips hardwired do S-501: LSLL de qualquer bolsa, PSLL medido na bolsa (≤ +0,5 mbar), PALL de qualquer reator, TSHH dos corta-chamas e O₂ alto. O PSLL de sucção, a −5 mbar, protege só o soprador.
   - O by-pass BYP-501 (descarga dos sopradores direto ao flare) serve para manutenção do GH-2 e fica fechado com chave presa.
4. **Retiradas de líquido, pela mesma lógica.** Purga ou esgotamento de um reator só acontece com ele ligado ao GH-1 que recebe (V-xGAS aberta, ZSO), com esse gasômetro ≥ 70% (RES-001 §5.6) e sem transferência ativa daquela bolsa. O gás da bolsa repõe o volume retirado e o reator não entra em vácuo.

## 2. Propriedades e vazões

- **Biogás** 60% CH₄ / 40% CO₂: ρ = 0,971 kg/m³ no sítio a 35 °C. Fator Nm³ → m³ reais: 1,251.
- **Pico de produção** (RES-001): planta 27.0 Nm³/h; R-201 e R-202 11.5 Nm³/h cada; R-101 4.5 Nm³/h (térmico incluso).

## 3. Pressão nos reatores (coletor ao GH-1 que recebe, vazão de pico)

| recebendo | reator | perda até o GH-1 (mbar) | pressão no reator (mbar) |
|---|---|---|---|
| GH-1A | R-101 | 0,051 | 0,55 a 2,05 |
| GH-1A | R-201 | 0,191 | 0,69 a 2,19 |
| GH-1A | R-202 | 0,215 | 0,71 a 2,21 |
| GH-1B | R-101 | 0,082 | 0,58 a 2,08 |
| GH-1B | R-201 | 0,177 | 0,68 a 2,18 |
| GH-1B | R-202 | 0,188 | 0,69 a 2,19 |

- **Pressão máxima nos reatores:** 2,21 mbar. Fica abaixo do PAH (+5), do selo hidráulico (+8) e do envelope (+15).
- **No resfriamento** (VC-01, até ≈ 2,7 Nm³/h de volta), o reator fica no máximo décimos de mbar abaixo do GH-1: sem vácuo enquanto a bolsa que recebe não estiver vazia (alarme LSL e trip LSLL).
- **Alívio próprio do GH-1** (selo d'água) entre +3 e +4 mbar: é o mais baixo do sistema, abaixo do selo dos reatores.
  - É **conduzido a uma chaminé fora do abrigo**, com capacidade ≥ 27 Nm³/h a ≤ +5 mbar (SP-02).
  - É o último recurso quando os sopradores ou o flare faltam. S-501, flare e intertravamentos ficam em energia de emergência.

## 4. Transferência GH-1 → GH-2

- **Sopradores S-501A/B:** 60 m³/h cada (A opera, B reserva), Δp ≈ 26,8 mbar.
  - O Δp soma GH-2 a 25 mbar, a sucção (2,23 mbar, com o corta-chamas FA-501) e a descarga (0,11 mbar).
  - Potência no eixo ≈ 0,11 kW: soprador de canal lateral ATEX de 0,55–0,75 kW.
- **Ciclo de uma bolsa de 60 m³:** enche em ≈ 1,8 h no pico e esvazia em ≈ 1,0 h.
  - A transferência termina antes de a outra encher: o soprador trabalha ≈ 56% do tempo.
- **GH-2 (≈ 180 m³):** pulmão dos consumidores. O volume final depende da LAC-052.

## 5. Flare

- **Capacidade de projeto ≥ 60 m³/h:** é a vazão do soprador, porque o by-pass do GH-2 pode mandar a descarga inteira ao flare.
  - Perda GH-2 → flare a 60 m³/h: 2,18 mbar, mais o corta-chamas.
- **Skid do flare:** bloqueio duplo, ignição piloto, detector de chama e corta-chamas de detonação FA-502. O consumidor tem o seu próprio corta-chamas, FA-503.
- **Tie-in dos consumidores:** duas retenções e PSHH no coletor (SP-09: refluxo do SK-501).
- **Grupo de gás IIC** em todo o sistema (corta-chamas, sopradores, gasômetros, analisador e detectores), porque o coletor comum recebe o gás do R-101, que tem H₂ (D-RES-10).
- **Distâncias de segurança** entre flare, gasômetros e consumidores a confirmar (LAC-051). No modelo, o flare fica ≈ 14 m do GH-2.

## 6. Condensado e material

- **Ramais dos reatores:** sobem do N3 e caem 1% de volta ao reator. Descem na vertical a potes de condensado no chão (PC-101/201/202), com dreno em selo hidráulico ≥ 2× a pressão máxima da linha.
- **Coletor e linhas de transferência:** pontos baixos nas entradas dos GH-1 e antes do S-501, com potes de dreno. Os drenos têm selo ≥ 250 mm de água, maior que +15/−8 mbar com margem, e controle de nível, para não virarem o alívio mais baixo nem admitirem ar.
- **Material:** linhas aéreas de gás em inox 304L/316L, ou PEAD só enterrado com proteção UV nas transições. O modelo desenha PEAD por simplicidade (LAC-051).

## 7. Fornecedor dos gasômetros

- **Plaslonas:** não encontrei catálogo técnico em fonte aberta. Pedir a ficha técnica (LAC-050).
- **Referência de mercado:** gasômetros de membrana operam de −1 a +5 mbar e os de dupla membrana com ventilador de suporte de 20 a 50 mbar. A faixa-alvo do GH-1 (≈ 0 a +2 mbar) e a do GH-2 (15–30 mbar) cabem nesses produtos.
- **Dados a pedir:** volume útil, pressão de operação e de alívio, medição de volume, material e resistência UV/H₂S, ventilador de suporte (GH-2), certificação de área classificada e garantia de estanqueidade.
