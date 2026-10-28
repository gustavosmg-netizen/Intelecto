---
name: modelagem-3d-engenharia
description: Transformar ideia, memorial descritivo, croqui ou fluxograma em modelo 3D de engenharia para construção (tanques, tubulações com curvas e flanges ASME/DN, bocais, válvulas/registros, misturadores, bombas, estruturas de concreto), exportando STEP para CAD, glTF para render e prévia PNG. Usa build123d + bd_warehouse (código, roda em qualquer lugar) e, no desktop, os MCPs FreeCAD (edição/TechDraw/IFC) e Blender (render realista). Palavras-gatilho: 3D, modelo 3D, maquete, isométrico, render, tubulação 3D, tanque, bocal, válvula, registro, misturador, agitador, STEP, IFC, glTF, FreeCAD, Blender.
---

# Modelagem 3D de engenharia (Intelecto)

## Cadeia de ferramentas (todas gratuitas)

| Etapa | Ferramenta | Onde roda | Para quê |
|---|---|---|---|
| Geometria paramétrica | `build123d` + `bd_warehouse` (scripts desta skill) | nuvem ou desktop | Tubos ASME B36.10, flanges ASME B16.5, tanques, válvulas, misturadores; exporta STEP/glTF |
| Iteração com visão | MCP `build123d` (`build123d-mcp`) | desktop (Claude Code) | Executa código, renderiza vistas, mede volumes/distâncias a cada passo |
| CAD/BIM editável | MCP `freecad` (`freecad-mcp`) + bancada **Quetzal** | desktop com FreeCAD aberto | Abrir o STEP, rotear tubulação, TechDraw (pranchas), exportar IFC/DXF |
| Render realista | MCP `blender` (`mcp-for-blender`) | desktop com Blender aberto | Importar o .glb, materiais PBR (aço, concreto, água), iluminação, imagens para apresentação |

Os três MCPs estão em `.mcp.json` na raiz do repositório (versões fixadas). Setup do desktop: `docs/ferramentas-3d/RELATORIO.md`.

## Fluxo obrigatório

1. **Especificar antes de modelar.** Extraia do memorial/croqui uma lista de equipamentos e linhas, e confirme com o usuário o que faltar:
   - Equipamento: tag, tipo, dimensões internas (D, H ou L×B×H), cota de fundo, material, espessura.
   - Bocal: tag, DN, classe de pressão, elevação, orientação (graus em planta ou `±x/±y/±z`), projeção.
   - Linha: tag, DN, serviço (água, esgoto, lodo, ar, químico), material, pontos (x, y, z) ou "do bocal X ao bocal Y".
   - Válvula/registro: tipo (gaveta, borboleta, retenção, esfera), DN, posição na linha.
   - Misturador: tipo (eixo vertical, submersível), diâmetro do rotor, profundidade, potência.
   Nunca invente cota ou DN: dado ausente é premissa declarada ou pergunta (ver `grau-de-liberdade`).
2. **Gerar em código.** Copie `scripts/piloto_tanque.py` para a pasta do projeto, troque os dados e rode:
   ```bash
   pip install -r .claude/skills/modelagem-3d-engenharia/scripts/requirements.txt
   python projeto_3d.py saida/
   python .claude/skills/modelagem-3d-engenharia/scripts/previa_png.py saida/modelo.glb saida/previa.png
   ```
   Importe as funções de `scripts/componentes.py` (`tanque_vertical`, `bocal`, `linha`, `flange`, `valvula_gaveta`, `misturador_vertical`, `exportar`). Componente novo entra em `componentes.py`, com o mesmo estilo.
3. **Conferir visualmente.** Abra a prévia PNG (ou use a ferramenta de render do MCP `build123d`) e verifique: linhas terminam na face dos flanges, nada atravessa paredes, curvas não colidem, válvulas acessíveis, cotas batem com o memorial.
4. **Refinar no desktop (opcional).**
   - FreeCAD: "abra `saida/modelo.step` no FreeCAD" via MCP `freecad`; detalhar com Quetzal, gerar TechDraw, exportar IFC.
   - Blender: "importe `saida/modelo.glb`, aplique aço inox escovado nos tubos, concreto no tanque, água com N.A. em 2,6 m e renderize em isométrico 1920×1080" via MCP `blender`.
5. **Entregar.** STEP (engenharia), GLB (visualização), PNG/render (apresentação). Antes de emitir para cliente, passar pelo `gate-de-lancamento`.

## Convenções

- Unidade **mm**, Z vertical, origem no centro do fundo do equipamento principal (ou no marco topográfico do projeto).
- DN→NPS pela tabela `DN_PARA_NPS`; diâmetro externo real vem da tabela ASME (DN80 → OD 88,9 mm). Para PVC/PEAD com outra série de OD, criar função própria em `componentes.py` com a norma citada.
- Curvas de raio longo (1,5·OD) por padrão; flanges WN classe 150 face com ressalto, salvo especificação.
- Cores por serviço em `CORES` (referência NBR 6493; seguir o padrão do cliente quando houver).
- Nome de cada peça = tag do projeto (`TQ-01`, `L-002-DN80`, `V-001-DN80`): vira o nome do objeto no STEP/glTF.
- Válvulas e misturadores de `componentes.py` são representativos (envelope e proporção). Para fabricante específico, importar o STEP do fabricante (`import_step`) no lugar.

## Limitações conhecidas

- `bd_warehouse` 0.4.0 tem incompatibilidade de nome de material com `bd_materials`; `componentes.py` aplica um alias (`steel`→`mild_steel`). Remover quando corrigido upstream.
- `linha()` só arredonda vértices quando o traçado é plano; em traçado 3D os cantos ficam vivos (inserir cotovelos manualmente ou quebrar em trechos planos).
- O glTF sai em Y-up (padrão do formato); Blender e visualizadores web já convertem.
- Os MCPs FreeCAD e Blender executam Python arbitrário na aplicação: salvar o trabalho antes e manter o servidor só em `localhost`.
