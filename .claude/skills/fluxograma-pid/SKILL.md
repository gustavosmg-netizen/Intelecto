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
   **Exemplo de referência (padrão executivo):** `modelos/thermobiogasup_genE/` - jogo F00-F02
   em A1 da planta ThermoBiogasUp (alternativa Gen E, pasta PROJETO_EXECUTIVO_OFICIAL), com
   `gerar_F01.py`/`gerar_F02.py`/`gerar_F00.py` que escrevem as specs (copie a estrutura).
   Outros: `modelos/ete_exemplo.json` (A3 simples); `modelos/thermobiogasup/` (Rev10, antigo).
   Saídas: `<numero>.dxf`, `<numero>.pdf` (cores por serviço), `<numero>_PB.pdf` (preto e
   branco), `<numero>.png` (conferência), `<numero>_line_list.csv`, `_equipment_list.csv`,
   `_instrument_index.csv`. Código de saída 1 = algo bloqueante (ver "Conferência").
   **Legenda (F00):** `python scripts/gerar_legenda.py F01.json F02.json --folha folha.json
   [--quadros q.json] -o F00.json` monta a folha só com o que as folhas usam (símbolos,
   serviços, bolhas) + quadros ISA-5.1 e de identificação; depois `gerar_pid.py F00.json`.
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
            "projeto": "<curto>", "unidade": "<curto>", "escala": "S/E",
            "desenho": "", "verificacao": "", "data": "", "empresa": "INTELECTO & CSTR",
            "escala_simbolos": 2.0},                       // A3 = 1 (padrão), A1 = 2
  "sheet": {"layer_set": "pid", "sheet_size": "A3", "scale": 1.0, "intent": "texto curto, ASCII"},
  "equipment":  [{"id", "symbol", "x", "y", "rotation"?, "tag", "desc", "params"?}],
  "valves":     [{"id", "symbol", "actuator"?, "fail"?, "x", "y", "tag"}],
  "instruments":[{"id", "type": "plc|dcs|discrete|computer", "location": "field|primary|...", "x", "y", "tag"}],
  "lines":      [{"from": "ID.porta", "to": "ID.porta", "class", "number", "route"?}],
  "connectors": [{"id", "direction": "in|out", "x", "y", "tag": "PID-002", "from"|"to", "class", "number"}],
  "derivacoes": [{"from": "ID.porta" | [x, y], "to": [x, y] | "ID.porta", "route"?: [[x, y]], "class", "number"}],
  "notas": ["1. ...", "2. ..."],                  // A1/A0: vão para a faixa NOTAS do carimbo
  "casa": {                                         // tudo desenhado no pós-processamento
    "areas":    [{"titulo", "x0", "y0", "x1", "y1", "cor"?: [r,g,b]}],      // retângulo tracejado
    "quadros":  [{"titulo", "x", "y", "altura"?, "colunas": [["NOME", larg]], "linhas": [[...]], "fonte"?}],
    "cotas":    [{"x0", "x1", "y", "texto"}],        // N.A. tracejado dentro do vaso (ou {"x","y","texto"})
    "simbolos": [{"simbolo": "emergencia|respiro|amostragem|...", "x", "y", "tag", "rotulo"?}],
    "linhas":   [{"pontos": [[x,y],...], "numero" | "servico", "seta"?, "rotulo"?}],
    "conexoes": [{"de": "LIT-101", "ate": [x, y]}], // instrumento -> processo (pontilhada)
    "sinais":   [{"de": "LSLL-101", "ate": [x, y], "via"?: [[x,y]]}],  // sinal elétrico tracejado
    "textos":   [{"texto", "x", "y", "altura"?, "alinh"?: "L|C|R"}],
    "sem_rotulo": ["LODO-2116"],                    // número só na lista (trecho curto/engate)
    "servicos": {"COD": ["descrição", [r,g,b], "Continuous|TRACO|TRACO_PONTO", 35]}
  }
}
```

Chaves extras por item (`equipment`/`valves`, tratadas pela casa): `"dados": [...]` (linhas de
dados de processo sob o TAG, como na referência), `"rotulo": {"x","y","alinh"}` (posição fixa
do bloco TAG/DESC/dados - use em região densa e para escrever dentro de vasos grandes) e
`"aparencia": "esteira|triturador|balanca|macerador|caldeira|gasometro"` (troca o desenho do
símbolo do catálogo pelo da casa sem perder a topologia nem a lista de linhas).

- `folha`, `derivacoes`, `notas` e `casa` são da casa (o script trata); o resto vai para `pid_from_spec`.
- **Formato da casa (A1/A0):** moldura com zonas + faixa inferior NOTAS | DOCUMENTOS DE REFERÊNCIA
  | REVISÕES (com tipos de emissão A-H) | CARIMBO (empresa, classificação, projeto, título, nº,
  rev., folha, escala, contrato, tipo de emissão, data). Campos em `folha`: `classificacao`,
  `contrato`, `tipo_emissao`, `revisoes` ([[rev, te, descrição, proj, ver, apr, data]]),
  `documentos` ([...]). A4-A2 seguem com o carimbo ISO 7200 em PT-BR.
- **Cores por serviço:** o código no número da linha (`LODO-1103`, `VP-1301`, `BRUTO-2211`)
  define cor, tipo e espessura (`SERVICOS_PADRAO` em `scripts/formato_casa.py`: LODO, SOL, AGUA,
  AT, QUIM, BRUTO, ACID, TRAT, GAS, ALIV, N2, VP, CD, GLP, AR, DR + códigos de ETE). Símbolos e
  textos ficam em preto, como na referência.
- `escala_simbolos` multiplica a escala de todo símbolo (e as dimensões em `params`, que então
  são dadas no tamanho base: tanque 45×55 sai 90×110 no A1). Acessório pequeno pode ter
  `"scale": 0.5` próprio (válvula de dreno, conector de engate rápido).
- Linha com `"label": false` não recebe rótulo (o número continua na lista de linhas). Conector
  carrega a própria linha (`to` se `in`, `from` se `out`); dois conectores podem ligar-se
  (`"from": "BL-AGUA"`).
- `rotation` 90/270 põe válvula em linha vertical e misturador lateral; o script devolve os
  rótulos à horizontal. Conector girado (ex.: 180° para entrar pela direita) tem o TAG interno
  endireitado automaticamente.
- TAG de projeto com malha alfanumérica (`LT-R101`, `ZS-VE01`) é aceito: a bolha mostra função
  em cima e malha embaixo, e o aviso do servidor vira informativo. TAG de válvula fora da ISA
  (`VF-101`, `VS-101FC`) gera aviso `pid_illegal_tag` — informativo quando é padrão do cliente.
- Portas: bombas `suction`/`discharge` (recalque sai para cima); válvulas `in`/`out` (+`signal`
  nas atuadas); tanques e vasos `N1..Nn` definidos em `params.nozzles` (`side`, `fraction`);
  soprador/compressor `in`/`out`; misturador `shaft` (para baixo); instrumento `signal`.
  Lista completa: ferramenta MCP `pid_symbol_list`.
- `derivacoes` faz **tê**: a linha sai de uma porta e termina num ponto `[x, y]` que esteja
  **sobre** uma linha já desenhada (o leitor do grafo registra a junção na lista de linhas).
  Use para barrilete de bombas em paralelo (1+1R), by-pass, dreno e retorno.

## Regras de leiaute (aprendidas no teste; seguir para não gerar retrabalho)

- Coordenadas em mm na folha 1:1. A3: área útil x 25–405, y 15–280, **carimbo em x ≥ 230 e
  y ≤ 75**. A1: área útil x 25–825, y 15–580, **carimbo em x ≥ 651 e y ≤ 75**, e
  `escala_simbolos: 2` (com ela, deixe ≥ 25 mm entre válvulas em série).
- Válvula e bomba a ≥ 20 mm uma da outra no eixo do fluxo, com o `y` da válvula igual ao
  do bocal (sucção da bomba = `y` da bomba; recalque = `x` da bomba e sobe 6 mm).
- Duas linhas que sairiam pelo mesmo eixo: dê `route` com waypoints em eixos distintos
  (ex.: sucções paralelas em x = 82 e x = 87). O script acusa trecho colado como **erro**.
- Instrumento só liga linha de **sinal** a outro instrumento, à porta `signal` de válvula
  atuada ou à placa de orifício. Transmissor de nível/OD/pH no tanque: posicione a bolha ao
  lado do tanque, sem linha (ligar sinal a bocal de processo é reprovado na crítica).
- TAG de conector curto (`F02`, `BL-01`); o destino vai no `link` (ex.: "P/ R-101").
- Vasos verticais/tanques: o bocal fica 3 mm (x escala) fora do corpo - conte isso nas folgas.
- Reator com fundo e tampo planos = `tank` com `roof: flat` (o `reactor` do catálogo tem
  tampos abaulados e exige altura > largura).
- Topo de reator denso (gás, selo, N2, misturador, alívio): use frações 0,08 / 0,30 / 0,50 /
  0,72 / 0,92 do topo, `rotulo` explícito para selo e alívio, e TAG do misturador nos dados do vaso.
- Cruzamento é aceito e sai com **quebra** (a linha mais fina é interrompida); minimize, mas
  não distorça a lógica para eliminá-los.
- `intent` e `sheet` em ASCII; textos de `desc`, `titulo` e `unidade` aceitam acentos.

## Conferência (o que o script verifica)

- Crítica do servidor: linha solta, TAG duplicado, ligação incompatível, instrumento sem
  TAG, TAG ISA ilegal, equipamento sem ligação (este último é só informativo).
- Da casa: trechos de linhas diferentes colados (erro; se saem do mesmo bocal, vira aviso de
  tê); texto/rótulo sobre linha, símbolo ou outro texto (aviso). Antes de acusar, o script já **reposiciona** números de linha (um
  por linha, deslizando no trecho livre mais longo e reduzindo a fonte se preciso; sequencial
  automático de linha sem número é apagado) e rótulos TAG/DESC (nove posições em volta do
  símbolo, empilhadas pela altura real do texto; bolhas ISA e TAG de conector nunca saem do
  lugar). Texto dentro de vaso é intencional e não é acusado. Aviso que sobra = ajustar
  coordenadas ou dar `rotulo` na spec. Larguras de texto são medidas com a métrica da fonte.
- Carimbo traduzido para PT-BR e título reduzido para caber no campo.

## Limites — dizer ao cliente/equipe, não esconder

- **P&ID é esquema**: não dá comprimento de tubo nem cota. Quantitativo vem da planta/isométrico.
- Catálogo é ISO 10628-2 / ISA-5.1 (43 símbolos). **Não há** símbolo próprio para gradeamento,
  comporta, vertedor, calha Parshall, canal aberto, UASB, decantador com raspador, difusor,
  leito de secagem. Símbolos da casa já disponíveis (`aparencia`/`casa.simbolos`): esteira,
  triturador, balança, macerador, caldeira, gasômetro, alívio de emergência, respiro, ponto de
  amostragem, sifão. Os demais: equivalente em `referencias/convencoes.md` com `desc` e nota.
- Em Linux sem Arial o PDF usa a fonte substituta (DejaVu); no AutoCAD o DXF abre com Arial.
- Simbologia NBR 8190 segue a ISA-5.1 (letras de identificação compatíveis); padrão
  Petrobras N-58 **não** está implementado — se o cliente exigir, avisar antes.
- O pacote é novo (v1.7.0, out/2026): versão fixada em `==1.7.0`. Atualizar só depois de
  rodar `modelos/ete_exemplo.json` e `modelos/thermobiogasup_genE/` e comparar.
