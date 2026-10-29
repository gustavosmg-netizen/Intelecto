---
name: modelagem-3d-engenharia
description: Transformar ideia, memorial descritivo, croqui ou fluxograma em modelo 3D de engenharia com sentido físico e hidráulico — tanques e caixas de concreto, tubulações de PVC (NBR 7362, 5647, DEFOFO) e PEAD (NBR 15561) com DE/espessura normativos, curvas, tês, reduções excêntricas, flanges PN10/16 com furação e parafusos reais, válvulas gaveta/borboleta/retenção/esfera, juntas de desmontagem, ventosas, sifão com selo hídrico, extravasor, descarga de fundo, bombas centrífugas e submersíveis, apoios — a partir de especificação YAML, com verificação automática (declividade, selo, ordem de válvulas no recalque, sucção, DN/PN, colisões, vãos) e lista de materiais. Exporta STEP, glTF e prévia PNG. Palavras-gatilho: 3D, modelo 3D, maquete, isométrico, tubulação 3D, tanque, bocal, flange, válvula, registro, sifão, extravasor, recalque, sucção, bomba, PVC, PEAD, STEP, glTF, FreeCAD, Blender.
---

# Modelagem 3D de engenharia (Intelecto)

## Regra principal

Todo desenho tem que funcionar fisicamente. Por isso o caminho padrão é **especificação YAML → `gerar_modelo.py` → relatório de verificação**. Modelo **REPROVADO** não se entrega: corrige-se a especificação até aprovar, e cada AVISO restante é justificado no memorial.

## Fluxo

1. **Especificar.** Extraia do memorial/croqui e escreva `<projeto>.yaml` no formato de `exemplos/tanque_equalizacao.yaml` (comentado). Pergunte o que faltar; nunca invente cota, DN ou N.A. (ver `grau-de-liberdade`).
   - `equipamentos`: `tanque`/`caixa` (retangular `comprimento × largura` ou `diametro`; `altura`, `parede`, `laje`, `na`, `na_max`, `bocais` com `papel` = entrada | saida | extravasor | descarga | succao) e `bomba` (`modelo: centrifuga | submersivel`, `dn_succao`, `dn_recalque`, `altura_eixo`, `origem`, `rotacao`).
   - Bocal: `parede` (leste/oeste/norte/sul) ou `azimute`, `posicao`, `dn`, `pn`, e `eixo` **ou** `geratriz_inferior` (soleira).
   - `linhas`: `material` (`pvc_esgoto`, `pvc_predial`, `pvc_pba`, `pvc_defofo`, `pead`), `dn` (PVC) ou `de` + `sdr` (PEAD), `regime` (gravidade | pressao), `servico`, `origem`/`destino` (porta `TQ-01.N4`, ponto livre, ou `{te: L-005, ponto: [...]}`), `pontos` (vértices), `componentes` (`gaveta`, `borboleta`, `retencao`, `esfera`, `junta_desmontagem`, `reducao` com `de2`/`dn2` e `excentrica`, `ventosa`), `vazao_ls`, `sifao`, `raio_curva` (× DE), `suportes`.
   - Sentido do escoamento = `origem` → `destino`. Componentes sem `distancia` ficam colados um ao outro na ordem escrita; `distancia: fim` encosta no destino.
   - Sifão: em `pontos`, entre a chegada e a saída, `{sifao: {selo: 100}}` gera o U; declare `sifao: {selo_min: …}` na linha.
2. **Gerar e verificar.**
   ```bash
   pip install -r .claude/skills/modelagem-3d-engenharia/scripts/requirements.txt
   python .claude/skills/modelagem-3d-engenharia/scripts/gerar_modelo.py projeto.yaml saida/
   ```
   Saídas: `.step`, `.glb`, `_previa.png`, `_verificacao.md` (resultado e achados H01–H13) e `_materiais.csv` (tubos em m e barras, curvas, flanges, parafusos, válvulas, apoios). Código de saída 1 = reprovado.
3. **Conferir visualmente** os pontos críticos (bomba, sifão, ligações nos bocais) com closes no Blender (`cena-industrial-3d`) ou no visualizador web.
4. **Refinar no desktop (opcional):** STEP no FreeCAD (MCP `freecad`, bancada Quetzal, TechDraw, IFC); render no Blender (MCP `blender`).
5. **Entregar** STEP + GLB + relatório de verificação + lista de materiais, pelo `gate-de-lancamento`.

## O que a verificação cobre

| Código | Regra |
|---|---|
| H01 | Montagem possível (componente cabe em trecho reto, curvas cabem nos trechos) |
| H02 | Linha sai/chega no eixo do bocal (sem curva colada ao flange) |
| H03 | DN e PN compatíveis nas juntas flangeadas (falta de redução, furação diferente) |
| H04 | Curvas com ângulo comercial (90/45/22,5/11,25° ± 2° de deflexão) |
| H05 | Conduto livre: declividade mínima (NBR 8160 / piso 0,5 %), sem aclive, saída abaixo da entrada |
| H06 | Sifão: selo hídrico ≥ mínimo; entrada acima da crista de saída |
| H07 | Tanque: entrada afogada, extravasor entre N.A. máx e borda, descarga no fundo com registro, saídas abaixo do N.A. com bloqueio |
| H08 | Bombas: sucção com registro, redução excêntrica de topo reto, sem ponto alto; recalque bomba → retenção → registro, junta de desmontagem |
| H09 | Velocidade (sucção ≤ 1,5 m/s; recalque 0,6–3,0 m/s) quando há `vazao_ls` |
| H10 | Ventosa em ponto alto de linha pressurizada |
| H11 | Bocal sem linha |
| H12 | Vão entre apoios ≤ tabela do material |
| H13 | Interferência física entre peças sem ligação |

`python scripts/testes_hidraulica.py` roda 10 casos (cada um injeta um erro típico e confere a regra). Rode depois de mexer em `hidraulica/`.

## Representação física

- Tubos com DE e espessura reais; PVC com bolsa a cada barra (6 m) e nas curvas; PEAD com cordão de solda a cada 12 m e nas conexões.
- Juntas flangeadas: adaptador flange-bolsa (PVC) ou colarinho + flange solto (PEAD), furação ISO 7005/EN 1092 PN10/16 e jogo de parafusos com porcas atravessando os dois flanges.
- Válvulas com face a face EN 558, volante/haste para cima (`cima: [x, y, z]` muda), retenção com seta de fluxo; junta de desmontagem com tirantes.
- Tubo de parede com anel de vedação (puddle flange) nos bocais de concreto; apoios de concreto com sela e abraçadeira; setas amarelas de sentido de escoamento.

## Arquivos

- `scripts/hidraulica/normas.py`: tabelas (DE e furação normativos; espessuras, face a face e vãos típicos de catálogo: conferir fabricante para compra).
- `scripts/hidraulica/geometria.py`: sólidos; `montagem.py`: especificação → modelo; `validacao.py`: regras e relatório.
- `scripts/componentes.py` + `piloto_tanque.py`: biblioteca antiga em aço ASME (B36.10/B16.5) para linhas metálicas; não tem verificação.

## Limitações

- Traçado por vértices informados (não há roteamento automático); componentes só em trechos retos.
- Bombas e válvulas são representativas (envelope, flanges e bocais corretos); para fabricante específico, importar o STEP dele no lugar.
- Não verifica NPSH, golpe de aríete nem tensão trativa: são cálculos do memorial.
- Os MCPs FreeCAD e Blender executam Python arbitrário na aplicação: salvar antes e manter só em `localhost`.
