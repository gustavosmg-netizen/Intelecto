---
name: fluxograma-pid
description: Gera fluxograma de engenharia (P&ID) e fluxograma de processo (PFD) em DXF, PDF A3/A1 e listas de linhas, equipamentos e instrumentos a partir de memorial, croqui, lista de equipamentos ou descrição de processo — ETE, ETA, elevatórias, dosagem química, utilidades. Usa o servidor MCP gratuito autocad-mcp-pro (motor ezdxf, sem AutoCAD) com símbolos ISO 10628-2 / ISA-5.1 como blocos com TAG e bocais, tubulações bocal a bocal com número de linha, registros, retenções, válvulas atuadas, bombas, sopradores, tanques com bocais, misturadores e malhas de instrumentação. Palavras-gatilho: fluxograma, P&ID, P&I, PFD, fluxograma de engenharia, fluxograma de processo, diagrama de tubulação e instrumentação, lista de linhas, lista de instrumentos, numeração de linhas, simbologia ISA, ISO 10628.
---

# Fluxograma de engenharia (P&ID) — Intelecto & CSTR

Transforma uma ideia, memorial ou croqui em um P&ID desenhado em CAD, com dados
consistentes: cada símbolo é um bloco com atributo TAG e bocais nomeados, cada linha liga
bocal a bocal e carrega número de linha, e as listas saem do próprio desenho (não de uma
planilha paralela). Tudo gratuito: `autocad-mcp-pro` (MIT), `ezdxf` (MIT), `fastmcp` (Apache-2.0).

## Dois caminhos

1. **Script (recomendado para folha completa)** — determinístico, com verificação e correções:
   ```bash
   uv run --no-project --with "autocad-mcp-pro[pdf]==1.7.0" --with pyyaml \
       python .claude/skills/fluxograma-pid/scripts/gerar_pid.py <spec.json|yaml> --saida saida_pid
   ```
   Saídas: `<numero>.dxf`, `<numero>.pdf` (monocromático, tamanho da folha), `<numero>.png`
   (conferência colorida por camada), `<numero>_line_list.csv`, `_equipment_list.csv`,
   `_instrument_index.csv`. Código de saída 1 = algo bloqueante (ver "Conferência").
2. **MCP `autocad-pid`** (registrado em `.mcp.json`) — para editar interativamente, inserir um
   símbolo, ler um P&ID de terceiros (`pid_graph`, `pid_line_list`) ou testar uma ideia
   (`pid_from_spec` com `dry_run=true`). Ferramentas `pid_*`, `titleblock_apply`, `drawing_*`.

## Fluxo de trabalho

1. **Ler a fonte** (memorial, croqui, lista) e montar, antes de desenhar, três listas:
   equipamentos (TAG, tipo, descrição, bocais), linhas (de → para, DN, serviço, material) e
   instrumentos (TAG ISA, o que mede, o que comanda). Faltou dado (DN, material, redundância
   de bomba, intertravamento)? **Perguntar**, não inventar. Use `grau-de-liberdade` /
   `intelecto-ete` quando o fluxograma depender de balanço ou dimensionamento.
2. **Dividir em folhas**: uma folha por unidade ou volume de controle (ex.: elevatória +
   equalização; reator; linha de lodo). Ligações entre folhas com `connectors` (offpage).
3. **Escrever a spec** partindo de `modelos/ete_exemplo.json` e seguindo
   `referencias/convencoes.md` (TAGs, numeração de linha, mapeamento de símbolos de saneamento).
4. **Gerar** com o script. Ler cada item reportado e corrigir a spec — não o DXF.
5. **Conferir o PNG** (Read na imagem) antes de entregar: fluxo da esquerda para a direita,
   nada sobre o carimbo, rótulos legíveis.
6. **Emitir**: DWG, se o cliente exigir, pela skill `cad-dwg-converter` ou pelo ODA File
   Converter (gratuito; com ele instalado, `drawing_export_dwg` passa a funcionar). Antes de
   liberar, `gate-de-lancamento` / `eng-auditor`.

## Formato da spec (JSON ou YAML)

```jsonc
{
  "folha": {"titulo": "...", "numero": "PID-XXX-001", "revisao": "0", "folha": "1/2",
            "projeto": "<centro de custo>", "unidade": "ETE - FASE LÍQUIDA", "escala": "S/E",
            "desenho": "", "verificacao": "", "data": "", "empresa": "INTELECTO & CSTR"},
  "sheet": {"layer_set": "pid", "sheet_size": "A3", "scale": 1.0, "intent": "texto curto, ASCII"},
  "equipment":  [{"id", "symbol", "x", "y", "rotation"?, "tag", "desc", "params"?}],
  "valves":     [{"id", "symbol", "actuator"?, "fail"?, "x", "y", "tag"}],
  "instruments":[{"id", "type": "plc|dcs|discrete|computer", "location": "field|primary|...", "x", "y", "tag"}],
  "lines":      [{"from": "ID.porta", "to": "ID.porta", "class", "number", "route"?}],
  "connectors": [{"id", "direction": "in|out", "x", "y", "tag": "PID-002", "from"|"to", "class", "number"}],
  "derivacoes": [{"from": "ID.porta", "to": [x, y], "route"?: [[x, y]], "class", "number"}]
}
```

- `folha` e `derivacoes` são da casa (o script trata); o resto vai direto para `pid_from_spec`.
- Portas: bombas `suction`/`discharge` (recalque sai para cima); válvulas `in`/`out` (+`signal`
  nas atuadas); tanques e vasos `N1..Nn` definidos em `params.nozzles` (`side`, `fraction`);
  soprador/compressor `in`/`out`; misturador `shaft` (para baixo); instrumento `signal`.
  Lista completa: ferramenta MCP `pid_symbol_list`.
- `derivacoes` faz **tê**: a linha sai de uma porta e termina num ponto `[x, y]` que esteja
  **sobre** uma linha já desenhada (o leitor do grafo registra a junção na lista de linhas).
  Use para barrilete de bombas em paralelo (1+1R), by-pass, dreno e retorno.

## Regras de leiaute (aprendidas no teste; seguir para não gerar retrabalho)

- Coordenadas em mm na folha 1:1. A3: área útil x 25–405, y 15–280; **o carimbo ocupa
  x ≥ 230 e y ≤ 75** — nada ali. A1: multiplique por 2.
- Válvula e bomba a ≥ 20 mm uma da outra no eixo do fluxo, com o `y` da válvula igual ao
  do bocal (sucção da bomba = `y` da bomba; recalque = `x` da bomba e sobe 6 mm).
- Duas linhas que sairiam pelo mesmo eixo: dê `route` com waypoints em eixos distintos
  (ex.: sucções paralelas em x = 82 e x = 87). O script acusa trecho colado como **erro**.
- Instrumento só liga linha de **sinal** a outro instrumento, à porta `signal` de válvula
  atuada ou à placa de orifício. Transmissor de nível/OD/pH no tanque: posicione a bolha ao
  lado do tanque, sem linha (ligar sinal a bocal de processo é reprovado na crítica).
- TAG de conector curto (`PID-002`); a descrição vai no `link`/nota.
- `intent` e `sheet` em ASCII; textos de `desc`, `titulo` e `unidade` aceitam acentos.

## Conferência (o que o script verifica)

- Crítica do servidor: linha solta, TAG duplicado, ligação incompatível, instrumento sem
  TAG, TAG ISA ilegal, equipamento sem ligação (este último é só informativo).
- Da casa: trechos de linhas diferentes colados (erro); texto/rótulo sobre linha, símbolo
  ou outro texto (aviso). Antes de acusar, o script já **reposiciona** números de linha (um
  por linha, no trecho livre mais longo) e rótulos TAG/DESC (abaixo, à direita, acima ou à
  esquerda do símbolo). Aviso que sobra = ajustar coordenadas na spec.
- Carimbo traduzido para PT-BR e título reduzido para caber no campo.

## Limites — dizer ao cliente/equipe, não esconder

- **P&ID é esquema**: não dá comprimento de tubo nem cota. Quantitativo vem da planta/isométrico.
- Catálogo é ISO 10628-2 / ISA-5.1 (43 símbolos). **Não há** símbolo próprio para gradeamento,
  comporta, vertedor, calha Parshall, canal aberto, UASB, decantador com raspador, difusor,
  leito de secagem. Até existirem blocos da casa, use o equivalente em
  `referencias/convencoes.md` com `desc` explícita e nota na folha.
- Simbologia NBR 8190 segue a ISA-5.1 (letras de identificação compatíveis); padrão
  Petrobras N-58 **não** está implementado — se o cliente exigir, avisar antes.
- O pacote é novo (v1.7.0, out/2026): versão fixada em `==1.7.0`. Atualizar só depois de
  rodar `modelos/ete_exemplo.json` e comparar.
