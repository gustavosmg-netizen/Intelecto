// Onda 3 · Sub-projeto C — lógica PURA da sugestão de CC por IA (sem D1, sem rede), importada pelo
// Worker (src/index.ts) e testada em test/onda3c.test.mjs. A IA SÓ SUGERE: o guard anti-invenção
// (parseSugestaoCC valida o cc contra a lista de candidatos) é o ponto mais testado; quem grava o cc
// é sempre o fluxoSet existente, por clique humano.

/**
 * Monta o prompt (system + user) da sugestão de CC para um movimento de caixa sem centro de custo.
 * @param {{descricao:string,valor:number,data:string}} mov
 * @param {Array<{cc:string,cliente:string,projeto:string}>} candidatos  projetos ATIVOS
 * @param {Array<{descricao:string,cc:string}>} historico  exemplos de movimentos já conciliados
 * @returns {{system:string,user:string}}
 */
export function montaPromptSugestaoCC(mov, candidatos, historico) {
  const m = mov || {};
  const cands = Array.isArray(candidatos) ? candidatos : [];
  const hist = Array.isArray(historico) ? historico : [];
  const system = "Voce e o assistente de conciliacao financeira da Intelecto & CSTR. Dado um movimento de caixa sem centro de custo (CC), "
    + "sugira a qual projeto ele pertence. Responda SOMENTE um objeto JSON, sem texto fora dele, com as chaves: "
    + "cc (string), confianca (numero de 0 a 1) e motivo (1 frase curta em portugues). "
    + "O cc DEVE ser exatamente um dos CCs da lista de candidatos informada, ou a string vazia \"\" se estiver incerto. "
    + "Nao invente cc. Na duvida, devolva cc vazio (incerto).";
  const linhas = [];
  linhas.push("Movimento:");
  linhas.push("- descricao: " + String(m.descricao == null ? "" : m.descricao).slice(0, 300));
  linhas.push("- valor: " + (Number.isFinite(Number(m.valor)) ? Number(m.valor) : ""));
  linhas.push("- data: " + String(m.data == null ? "" : m.data).slice(0, 10));
  linhas.push("");
  linhas.push("CCs candidatos (cc | cliente | projeto):");
  if (!cands.length) linhas.push("(nenhum)");
  for (const c of cands) linhas.push("- " + [c.cc, c.cliente, c.projeto].map((x) => String(x == null ? "" : x).slice(0, 120)).join(" | "));
  if (hist.length) {
    linhas.push("");
    linhas.push("Exemplos de movimentos ja conciliados (descricao -> cc):");
    for (const h of hist) linhas.push("- " + String(h.descricao == null ? "" : h.descricao).slice(0, 120) + " -> " + String(h.cc == null ? "" : h.cc));
  }
  return { system, user: linhas.join("\n") };
}

/**
 * Parse tolerante da resposta do modelo + guard anti-invenção: o cc só passa se estiver em ccsValidos;
 * fora da lista (alucinação) ou resposta ilegível → cc="" (incerto). Nunca lança.
 * @param {string} textoIA
 * @param {string[]} ccsValidos
 * @returns {{cc:string,confianca:number|"",motivo:string}}
 */
export function parseSugestaoCC(textoIA, ccsValidos) {
  const vazio = { cc: "", confianca: "", motivo: "" };
  try {
    const m = String(textoIA == null ? "" : textoIA).match(/\{[\s\S]*\}/);
    if (!m) return vazio;
    const j = JSON.parse(m[0]);
    if (!j || typeof j !== "object") return vazio;
    const motivo = String(j.motivo == null ? "" : j.motivo).trim().slice(0, 300);
    const bruto = (typeof j.cc === "string" || typeof j.cc === "number") ? String(j.cc).trim() : "";
    const validos = Array.isArray(ccsValidos) ? ccsValidos.map((x) => String(x)) : [];
    const cc = bruto && validos.includes(bruto) ? bruto : "";
    let confianca = "";
    if (j.confianca !== null && j.confianca !== "" && j.confianca !== undefined && typeof j.confianca !== "boolean") {
      let n = Number(j.confianca);
      if (Number.isFinite(n)) {
        if (n > 1) n = n <= 100 ? n / 100 : 1; // modelo respondeu em %
        confianca = Math.max(0, Math.min(1, n));
      }
    }
    return { cc, confianca, motivo };
  } catch (_) { return vazio; }
}
