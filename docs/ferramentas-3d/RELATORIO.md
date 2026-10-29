# Ferramentas 3D de engenharia para Claude: pesquisa e instalação

Data: 2026-10-28 · Critérios: gratuito/open-source, uso no computador (desktop), transformar memorial/croqui em 3D com tubulações, tanques, bocais, registros e misturadores.

## Recomendação

Cadeia em três camadas, todas gratuitas e já configuradas neste repositório:

1. **build123d + bd_warehouse** (biblioteca Python) com a skill `modelagem-3d-engenharia`: o Claude escreve o modelo em código, com tubos e flanges nas dimensões ASME reais. Funciona até na nuvem, sem programa aberto. Testado nesta sessão (piloto: tanque Ø2000×3000 com fundo cônico, 2 bocais flangeados, 2 linhas com curvas, válvula gaveta e misturador → STEP + GLB + PNG).
2. **MCP FreeCAD** (`neka-nat/freecad-mcp`) + bancada **Quetzal**: abre o STEP no FreeCAD para edição, roteamento de tubulação, pranchas TechDraw e exportação IFC/DXF.
3. **MCP Blender** (`mcp-for-blender`, antigo `blender-mcp`): render realista (materiais PBR, água, iluminação) para apresentação.

## Comparativo

| Ferramenta | Tipo | Licença | Maturidade (out/2026) | Ponto forte | Limitação |
|---|---|---|---|---|---|
| [build123d-mcp](https://pypi.org/project/build123d-mcp/) | MCP | Apache-2.0 | v0.3.91 (15/10/2026) | Claude vê o resultado (render de vistas, medições) a cada passo; exporta STEP/STL/DXF/SVG | Não exporta glTF pelo MCP (a skill exporta) |
| [bd_warehouse](https://bd-warehouse.readthedocs.io/) | Biblioteca | Apache-2.0 | v0.4.0 (07/10/2026) | Tubos ASME B36.10/B36.19 e flanges ASME B16.5 (WN, SO, SW, cego, lap joint) | Sem válvulas/tês prontos; bug de material contornado na skill |
| [neka-nat/freecad-mcp](https://github.com/neka-nat/freecad-mcp) | MCP | MIT | ~3,1 mil estrelas; v0.1.28 (25/10/2026) | O mais usado; cria/edita objetos, roda Python, captura tela, FEM | Requer FreeCAD aberto com o addon |
| [spkane/freecad-mcp (Robust)](https://lobehub.com/mcp/spkane-freecad-mcp) | MCP | — | v0.6.1 (jan/2026) | 150+ ferramentas, modo headless/Docker | Menos ativo; alternativa se o neka-nat não bastar |
| [theosib/FreeCAD-MCP-Server](https://github.com/theosib/FreeCAD-MCP-Server) | MCP | — | — | Inspeção profunda da árvore de features | Foco em inspeção, não em criação |
| [Quetzal](https://github.com/EdgarJRobles/Quetzal) (sucessor do Dodo/Flamingo) | Bancada FreeCAD | LGPL-3.0 | v1.8.11 (ago/2026), via Addon Manager | Tubos, curvas, flanges, reduções, tampões, estruturas metálicas | Válvulas ainda simplificadas |
| [mcp-for-blender](https://github.com/ahujasid/blender-mcp) | MCP | MIT | v2.2.6 (28/10/2026) | Render, inspeção por imagem, bibliotecas de assets (Poly Haven, Sketchfab) | Socket sem autenticação (só localhost); telemetria mínima ligada por padrão (desligada no `.mcp.json`) |
| [Bonsai_mcp](https://github.com/JotaDeRodriguez/Bonsai_mcp) | MCP (Blender+IFC) | MIT | 66 estrelas | Lê/edita IFC, quantitativos, exporta orçamento BC3 | Imaturo; criação limitada a `place_ifc_object` |

**Descartados pelo critério de custo:** plugin `revit-bim` do diretório de plugins da Anthropic (exige Revit), packs Python do AutoCAD Plant 3D (pagos). **Fora de escopo:** plugin "3D CAD Converter" (só conversão de formatos, Windows). O registro de conectores do claude.ai e o catálogo de skills não têm nada de modelagem 3D de processo além das skills CAD 2D que você já tem.

## O que foi instalado neste repositório

- `.mcp.json`: servidores `build123d`, `freecad` e `blender`, com versões fixadas (≥ 2 semanas de publicação). O Claude Code pede aprovação na primeira vez que abrir o projeto.
- `.claude/skills/modelagem-3d-engenharia/`: skill com o fluxo memorial → especificação → 3D → conferência → entrega, e scripts:
  - `componentes.py`: `tanque_vertical`, `bocal`, `linha`, `flange`, `valvula_gaveta`, `misturador_vertical`, `exportar`.
  - `piloto_tanque.py`: exemplo completo para copiar e adaptar.
  - `previa_png.py`: prévia PNG de um .glb sem interface gráfica.

## Setup no seu computador (uma vez)

1. Instale **uv**: <https://docs.astral.sh/uv/getting-started/installation/> (use o instalador oficial, não `pip install uv`).
2. **FreeCAD 1.x**: <https://www.freecad.org/downloads.php>
   - `Ferramentas › Gerenciador de Addons` → instalar **Quetzal**.
   - Addon do MCP: `git clone https://github.com/neka-nat/freecad-mcp.git` e copiar `addon/FreeCADMCP` para a pasta `Mod` do FreeCAD (Windows: `%APPDATA%\FreeCAD\Mod`; Linux: `~/.local/share/FreeCAD/Mod`; macOS: `~/Library/Application Support/FreeCAD/Mod`). Reiniciar.
   - Para usar: bancada **MCP Addon** → **Start RPC Server**.
3. **Blender 4.x**: <https://www.blender.org/download/>
   - `uvx mcp-for-blender@2.1.9 install-addon` e ativar "Interface: MCP for Blender" em `Edit › Preferences › Add-ons`.
   - Para usar: viewport 3D → tecla `N` → aba MCP for Blender → **Start MCP Server**.
4. Abra o Claude Code na pasta do repositório e aprove os servidores de `.mcp.json`. No Claude Desktop (fora do Claude Code), copie o mesmo bloco `mcpServers` para `claude_desktop_config.json`.
5. Se aparecer `spawn uvx ENOENT`, troque `uvx`/`uv` pelo caminho completo do executável.

## Como pedir nos próximos trabalhos

> "Use a skill modelagem-3d-engenharia. A partir do memorial anexo, modele o tanque de equalização TQ-01 com os bocais e linhas listados, exporte STEP e GLB e me mostre a prévia. Depois renderize no Blender com concreto aparente e N.A. em 2,6 m."

## Segurança

Os MCPs de FreeCAD e Blender executam Python arbitrário dentro da aplicação. Salve o trabalho antes, mantenha os servidores só em `localhost` e rode um cliente MCP por vez (não Claude Desktop e Claude Code ao mesmo tempo no mesmo Blender).

## Atualização: gerador hidráulico com verificação (out/2026)

A skill `modelagem-3d-engenharia` passou a gerar o modelo a partir de uma especificação YAML (`exemplos/tanque_equalizacao.yaml`, `exemplos/elevatoria_submersivel.yaml`) com:

- PVC (NBR 7362, NBR 5688, NBR 5647, DEFOFO) e PEAD (NBR 15561) com DE normativo; flanges ISO 7005/EN 1092 PN10/16 com furação e parafusos; válvulas com face a face EN 558;
- conexões (curvas, tês, reduções concêntricas/excêntricas, juntas de desmontagem, ventosas), sifão com selo hídrico, extravasor, descarga de fundo, tubo de parede com anel de vedação, bombas centrífuga e submersível, apoios de concreto, setas de fluxo;
- verificação automática H01–H13 (declividade, selo, ordem de válvulas no recalque, sucção, DN/PN, colisões, vãos, etc.), relatório e lista de materiais;
- `scripts/testes_hidraulica.py`: 10 casos de regressão (erros injetados).
