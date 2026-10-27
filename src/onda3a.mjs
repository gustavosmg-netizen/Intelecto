// Onda 3 · Sub-projeto A — lógica PURA (sem D1, sem rede), importada pelo Worker (src/index.ts)
// e testada em test/onda3a.test.mjs. Mantê-la pura é o que torna o comportamento testável no
// `node --test` estático da casa. As ações do Worker montam os args e executam os statements.

/**
 * Plano de criação do projeto PROPOSTO a partir de um contrato confirmado.
 * Idempotente por construção: o INSERT em proj usa ON CONFLICT(cc) DO NOTHING; a parcela só é
 * criada quando ainda não há parcela para o contrato (temParcela=false). O VALOR não é regravado
 * em projx.contratado — o dono do valor é o contrato (valorContratadoMap deriva dele).
 * @param {{cc:string,valor:number,status:string,titulo:string,contratoId:string,tenant:string,now:string,parcelaId:string}} c
 * @param {{flagOn:boolean,temParcela:boolean}} opts
 * @returns {Array<{sql:string,args:any[]}>} statements a executar (vazio quando não deve disparar)
 */
export function planoProporProjeto(c, opts) {
  const { cc, valor, status, titulo, contratoId, tenant, now, parcelaId } = c || {};
  const { flagOn, temParcela } = opts || {};
  if (!flagOn || status !== "confirmado" || !cc || !(Number(valor) > 0)) return [];
  const stmts = [
    {
      sql: "INSERT INTO proj (cc,projeto,status,registro,alterado_por,alterado_em,tenant_id) "
        + "VALUES (?,?, 'A INICIAR', 'PROPOSTO', 'contrato', ?, ?) ON CONFLICT(cc) DO NOTHING",
      args: [cc, String(titulo || cc).slice(0, 200), now, tenant],
    },
    {
      // projx nasce só com a chave; contratado fica no fallback (valor é do contrato).
      sql: "INSERT INTO projx (cc,tenant_id,u) VALUES (?,?, 'contrato') ON CONFLICT(cc) DO NOTHING",
      args: [cc, tenant],
    },
  ];
  if (!temParcela) {
    stmts.push({
      sql: "INSERT INTO contrato_parcela (id,tenant_id,contrato_id,cc,numero,valor,venc_prev,status,obs,criado,u) "
        + "VALUES (?,?,?,?,1,?, '', 'prevista', '', ?, 'contrato')",
      args: [parcelaId, tenant, contratoId, cc, Number(valor), now],
    });
  }
  return stmts;
}

/**
 * Decide se um lançamento de horas deve ser bloqueado por o projeto estar encerrado.
 * Encerrado = status contém CONCLU ou CANCEL. A exceção só vale com forcar E capability de aprovar.
 * @param {string} status  status do projeto (proj.status)
 * @param {{forcar:boolean,podeAprovar:boolean}} opts
 * @returns {{bloqueia:boolean}}
 */
export function decideBloqueioHoras(status, opts) {
  const { forcar, podeAprovar } = opts || {};
  const enc = /CONCLU|CANCEL/.test(String(status || "").toUpperCase());
  return { bloqueia: enc && !(forcar && podeAprovar) };
}

/**
 * Regras NOVAS do Painel de Consistência da Onda 3-A (as C1..C16 seguem inline no index.ts).
 * @param {string} T  tenant_id
 * @returns {Array<{rule:string,titulo:string,sev:string,dono:string,atalho:string,sql:string,args:any[]}>}
 */
export function regrasExtra(T) {
  return [
    {
      rule: "C17", titulo: "Contrato confirmado sem projeto", sev: "alto", dono: "Coordenação", atalho: "Projeto 360 › Visão",
      sql: "SELECT COUNT(*) n FROM (SELECT DISTINCT cc, tenant_id FROM cc_contrato WHERE status='confirmado') c "
        + "WHERE c.tenant_id = ? AND NOT EXISTS (SELECT 1 FROM proj p WHERE p.cc=c.cc AND p.tenant_id=c.tenant_id)",
      args: [T],
    },
    {
      rule: "C18", titulo: "Projeto PROPOSTO aguardando aprovação há >7 dias", sev: "medio", dono: "Coordenação", atalho: "Projetos › Propostas",
      sql: "SELECT COUNT(*) n FROM proj WHERE tenant_id = ? AND registro='PROPOSTO' AND alterado_em <> '' AND alterado_em < datetime('now','-7 day')",
      args: [T],
    },
  ];
}
