---
name: cena-industrial-3d
description: Transformar um modelo 3D de engenharia (.glb/.step da skill modelagem-3d-engenharia) em cena industrial realista: visualizador interativo em tempo real no navegador (órbita, seleção por tag, corte, nível d'água, misturador girando) publicável como link, render cinematográfico no Blender (materiais PBR, céu, sol, câmera, turntable) e, no desktop, cena em Unreal Engine via plugin oficial da Epic. Palavras-gatilho: cena 3D, tempo real, interativo, visualizador, walkthrough, render realista, cinematográfico, apresentação ao cliente, maquete eletrônica, Unreal, Twinmotion, Blender, three.js, gêmeo digital.
---

# Cena industrial 3D (tempo real e cinematográfica)

Pré-requisito: o modelo vem da skill `modelagem-3d-engenharia` (peças nomeadas pela tag: `TQ-01`, `N1-…`, `L-002-DN80`, `V-001-DN80`, `MX-01`, `B-01`). Esses prefixos definem o material em todas as saídas abaixo.

## Escolha da saída

| Pedido | Saída | Onde roda |
|---|---|---|
| Reunião com cliente, link para navegar, celular | **Visualizador web** (`viewer/visualizador.html`, three.js) | qualquer navegador; publicável como Artifact |
| Imagem ou vídeo de apresentação | **Blender** (`scripts/cena_blender.py`) | nuvem (bpy) ou desktop (MCP `blender`) |
| Passeio cinematográfico em tempo real, alta fidelidade | **Unreal Engine 5** + plugin oficial "Unreal Engine Skills" | desktop com GPU dedicada |

## 1. Visualizador web interativo

1. Gere o .glb (skill de modelagem).
2. Embuta o modelo e publique:
   ```bash
   cp -r .claude/skills/cena-industrial-3d/viewer <pasta_do_projeto>/visualizador
   python .claude/skills/modelagem-3d-engenharia/scripts/gerar_modelo.py projeto.yaml saida_web/ --deflexao 6 --sem-colisao
   python .claude/skills/cena-industrial-3d/scripts/embutir_modelo.py saida_web/<arquivo>.glb <pasta_do_projeto>/visualizador/modelo.js \
          --titulo "TQ-01 equalização" --subtitulo "verificação hidráulica aprovada · m"
   ```
   O título da página vem de `--titulo` (edite também o `<title>` da página). Publique `visualizador.html` com a ferramenta Artifact, passando `files: {"modelo.js": …}`. O Artifact não serve `.glb`; por isso o `modelo.js` em base64.
3. Localmente: `python -m http.server` na pasta e abrir `visualizador.html` (lê `modelo.glb`), ou arrastar qualquer .glb para a página.

Recursos: vistas isométrica/planta/frente/lateral, clique para ficha da peça (tag, DN, envelope, elevação do topo), camadas por tipo, corte vertical, N.A. ajustável nos tanques, misturadores girando, layout de celular, tema claro/escuro.

## 2. Render cinematográfico no Blender

Headless (nuvem ou desktop, sem abrir o Blender):
```bash
pip install bpy==5.2.3            # Blender como módulo Python (Python 3.13)
python .claude/skills/cena-industrial-3d/scripts/cena_blender.py saida/modelo.glb saida/render.png \
       --na 2600 --amostras 128 --res 1920x1080 --blend saida/cena.blend
# vídeo de giro 360°: acrescente --turntable 240 e use saída tipo saida/frames/f_####.png
```
Com o Blender aberto (MCP `blender`): `execute_blender_code` com o conteúdo do script e `montar_cena("modelo.glb", "render.png", na_mm=2600)`, depois `look` para conferir. Para mais realismo, troque o céu procedural por um HDRI CC0 da Poly Haven (`search_assets` + `import_asset` do MCP) e aplique texturas CC0 (Poly Haven/ambientCG) no concreto e no aço.

O script aplica: concreto/chapa no tanque, aço nos bocais, cor de serviço nas linhas (vem do glTF), ferro fundido vermelho nas válvulas, azul industrial no misturador, piso de concreto, água com IOR 1,33 no N.A., céu físico, sol com sombra suave, câmera 35 mm com profundidade de campo, Cycles com denoise e AgX.

## 3. Unreal Engine 5 (desktop)

1. Instale o Unreal Engine 5 (Epic Games Launcher). Gratuito para uso não-jogo em empresas com receita bruta anual abaixo de US$ 1 milhão; acima disso, licença por assento.
2. No Claude Code: `/plugin install unreal-engine-skills-for-claude-code@claude-plugins-official`.
3. No projeto Unreal, ative os plugins **ModelContextProtocol**, **AllToolsets** e **glTF Importer**; no console do editor: `ModelContextProtocol.StartServer` e `ModelContextProtocol.GenerateClientConfig ClaudeCode`.
4. Peça: "importe `modelo.glb`, crie materiais PBR por prefixo de tag como na skill cena-industrial-3d, ilumine com Sky Atmosphere + Directional Light, monte um Level Sequence de sobrevoo de 30 s e renderize com Movie Render Queue".

## Regras

- Escala real em metros; nunca escale peças para "ficar bonito".
- A cena é ilustrativa: dimensões, cotas e DN valem pelo modelo de engenharia, e o rodapé da entrega deve dizer isso.
- Não publique cena de cliente em link sem autorização (regra de confidencialidade em `intelecto-contexto`); o Artifact nasce privado.
