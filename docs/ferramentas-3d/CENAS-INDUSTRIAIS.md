# Cenas industriais 3D em tempo real: pesquisa e instalação

Data: 2026-10-29 · Critérios: cena interativa/tempo real de tubulações e tanques realistas; ferramentas gratuitas (inclusive não open-source); uso no desktop. Complementa `RELATORIO.md` (modelagem).

## Recomendação

| Prioridade | Solução | Por quê |
|---|---|---|
| 1 | **Visualizador web three.js** (skill `cena-industrial-3d`, instalado e testado) | Abre em qualquer navegador e celular, vira link privado para o cliente, roda direto do .glb da skill de modelagem. MIT. |
| 2 | **Unreal Engine 5 + plugin oficial da Epic** ("Unreal Engine Skills", diretório de plugins da Anthropic, publicador verificado `epicgames`, MIT) | Maior fidelidade em tempo real (Lumen, Nanite) e Sequencer para sobrevoos; o Claude controla o editor com 30+ conjuntos de ferramentas (atores, materiais, Sequencer, Niagara). Exige GPU dedicada. |
| 3 | **Blender** (MCP `mcp-for-blender`, já no `.mcp.json`) + `cena_blender.py` | Imagens e vídeos de giro fotorrealistas; Eevee para pré-visualização em tempo real; roda até sem interface (`bpy`). |

## Comparativo

| Ferramenta | Tempo real | Integração com Claude | Custo | Observação |
|---|---|---|---|---|
| three.js (visualizador da skill) | Sim, navegador | Claude escreve/publica a página | Grátis (MIT) | Testado: 7 peças do piloto, seleção, corte, N.A., misturador girando, layout de celular |
| [Unreal Engine Skills (Epic)](https://github.com/epicgames/unreal-engine-skills-for-claude-code-plugin) | Sim, editor/executável | Plugin oficial + MCP nativo do editor | UE grátis para uso não-jogo abaixo de US$ 1 mi/ano de receita | Requer plugins ModelContextProtocol e AllToolsets no projeto |
| [UEMCP](https://pypi.org/project/uemcp/) (comunidade) | Sim | MCP via Python remoto do UE, sem compilar | Grátis | Alternativa se o plugin oficial não atender sua versão do UE |
| [Twinmotion](https://www.twinmotion.com/license) | Sim | Nenhum MCP encontrado | Grátis abaixo de US$ 1 mi/ano | Fluxo manual: importar o .glb/.fbx e montar a cena |
| [Unity (plugin oficial)](https://github.com/unity-technologies/unity-agent-plugin) | Sim | Plugin oficial no diretório da Anthropic + [MCP do Unity AI](https://unity.com/blog/unity-ai-mcp-how-to-get-started) | Unity Personal grátis abaixo de um limite de receita | Foco em jogos; menos material pronto para AEC que o Unreal |
| [mcp-for-blender](https://github.com/ahujasid/blender-mcp) | Eevee (viewport) | MCP (já configurado) | Grátis (MIT) | Melhor para render cinematográfico; importa HDRIs/texturas Poly Haven |
| Godot MCP ([Coding-Solo](https://mcpservers.org/zh-TW/servers/Coding-Solo/godot-mcp)) | Sim | MCP comunidade | Grátis | Orientado a jogos; descartado |
| [realvirtual WEB](https://dev.to/thomas_s_9e168f78d28ba60e/realvirtual-web-an-open-source-3d-hmi-for-industrial-digital-twins-in-the-browser-4ifn) | Sim, navegador | Nenhuma | AGPL-3.0 | Gêmeo digital com PLC/MQTT; interessante se um dia houver dados de operação ao vivo |
| [xeokit](https://www.jsdelivr.com/package/npm/@vrame/xeokit-sdk) / IFC.js | Sim, navegador | Nenhuma | AGPL / MIT | Visualizadores de IFC/BIM; úteis se o entregável for IFC |

**Skills de three.js de terceiros** (CloudAI-X/threejs-skills, claudekit-skills `threejs`, `threejs-fundamentals` no skills.sh) e o plugin `parallax-threejs` (depuração de three.js) existem, mas são genéricos e de comunidade; a skill `cena-industrial-3d` já cobre o caso de uso com convenções da Intelecto. Avaliar só se o visualizador crescer muito.

## Bibliotecas de materiais e ambientes (uso comercial)

- **Poly Haven**: HDRIs, texturas e modelos CC0; acessível pelo MCP do Blender (`search_assets`/`import_asset`).
- **ambientCG**: texturas PBR CC0 (concreto, aço, metal pintado). Não consegui conferir a página de licença desta sessão (domínio bloqueado na rede da nuvem); confira antes de usar.
- **OpenGameArt "PBR Industrial Asset Pack"**: tanques e tubos CC0 para compor o entorno.
- **Megascans (Fab)**: deixou de ser gratuito a partir de 2025; só parte do acervo continua grátis.

## O que foi instalado

- `.claude/skills/cena-industrial-3d/`
  - `viewer/visualizador.html`: visualizador three.js 0.186.1 (vistas, ficha por tag, camadas, corte, N.A., misturador animado, arrastar .glb).
  - `scripts/embutir_modelo.py`: gera `modelo.js` para publicar o visualizador como Artifact.
  - `scripts/cena_blender.py`: cena cinematográfica no Blender (materiais PBR por tag, piso, água, céu, sol, câmera com profundidade de campo, Cycles/AgX, turntable). Testado com `bpy` 5.2.3: 1920×1080 em ~40 s na CPU da nuvem com 24 amostras.
- Exemplo publicado (privado): visualizador do piloto TQ-01.

## Setup do Unreal no seu computador

1. Epic Games Launcher → instalar Unreal Engine 5.
2. Claude Code: `/plugin marketplace add anthropics/claude-plugins-official` (se necessário) e `/plugin install unreal-engine-skills-for-claude-code@claude-plugins-official`.
3. No projeto UE: ativar **ModelContextProtocol** e **AllToolsets**; no console: `ModelContextProtocol.StartServer` e `ModelContextProtocol.GenerateClientConfig ClaudeCode`.
4. Windows precisa de Git for Windows ou WSL (o plugin usa bash no início da sessão).
