# Drill de restauração do backup — RPO/RTO (E-05)

> Portal Intelecto · Worker `portal-intelecto` · D1 `portal-intelecto` · bucket R2 `portal-intelecto-backup`.
> Este documento é o runbook de recuperação de um incidente de **perda de dados** no D1 e o
> procedimento do **drill** (ensaio de restauração) que prova que o backup é recuperável.

---

## 1. O que existe hoje (ponto de partida)

- **Backup diário automático** do D1 → R2. Cron `0 6 * * *` (03:00 BRT) chama `backupD1()`
  (`src/index.ts`), que serializa cada tabela de dados em um único JSON e grava em
  `portal-intelecto-backup` na chave `d1/portal-intelecto-AAAA-MM-DD.json`.
- **Retenção: 90 dias** (`BACKUP_RET_DIAS`). Backups mais antigos são apagados pela própria rotina.
- **Backup sob demanda**: ação `backup_now` (dono-only) gera um backup na hora.
- **Exclusões do backup** (`BACKUP_SKIP`): `amb_registro` e `amb_agg` — os ~151k leads
  ambientais. São uma **projeção reconstruível** carregada da fonte (Base Empreendimentos MG)
  por `wrangler`, não dado irreparável. Ficam fora para o backup permanecer pequeno e, sobretudo,
  **restaurável dentro do limite de memória do Worker**. Ver §6.

O que o backup protege, então, é o **dado que não se recompõe sozinho**: operação (projetos,
horas, cronograma), financeiro (contratos, parcelas, caixa, custo-hora), CRM, academia, pessoas,
acessos e a trilha de auditoria.

---

## 2. RPO e RTO (metas de recuperação)

| Métrica | Valor | Base |
|---|---|---|
| **RPO** (perda máxima de dados aceitável) | **≤ 24 h** | Backup é diário. No pior caso perde-se o que foi escrito desde o último backup das 03:00 BRT. |
| **RPO efetivo (mitigado)** | **minutos a horas** | A **trilha de auditoria** (`audit`) registra as ações sensíveis com timestamp e autor; os eventos operacionais (horas, lançamentos, parcelas) têm data própria. O que entrou após o último backup é, em boa parte, **reconstituível** a partir da trilha e das origens (planilha de horas, livro-caixa, CRM). |
| **RTO** (tempo até voltar a operar) | **≤ 1 h** | Restauração = ler 1 objeto do R2 + reescrever as tabelas. Nos volumes atuais (dado operacional, sem os leads), o `apply` roda em **segundos a poucos minutos**; o RTO é dominado pela decisão humana (confirmar o incidente, escolher o backup, reautenticar) e pelo redeploy, se preciso. |

> **Como melhorar o RPO no futuro** (fora do escopo do E-05): aumentar a frequência do cron
> (ex.: de 24 h para 6 h) e/ou registrar um log de escrita incremental. Hoje o par
> *backup diário + trilha de auditoria* já dá um RPO efetivo baixo para o dado crítico.

---

## 3. A ação `restore_backup`

Lê um dump do bucket BACKUP e o reescreve no D1 ligado **a este Worker** (staging restaura no D1
de staging; produção, no de produção).

- **Gate**: dono-only (`isOwner`) **+ reauth** (ação em `SENSIVEIS` → exige senha reconfirmada nos
  últimos minutos). Toda restauração aplicada vai para a trilha (`audit` → evento `restore_backup`,
  retido permanentemente).
- **Modo `verify` (padrão)** — não escreve nada. Devolve o **manifesto** do backup: chave,
  `gerado_em`, nº de backups disponíveis, tabelas e linhas por tabela, total de linhas.
- **Modo `apply`** — para cada tabela do dump: `DELETE` + reinserção em lotes (`INSERT OR REPLACE`,
  40 linhas/lote). **Exige `confirmar:true`**. Pula `BACKUP_SKIP` e tabelas ausentes no schema atual
  (best-effort por tabela; devolve `restauradas[]` e `falhas[]`).
- **Trava de ambiente**: `apply` real **só em staging** (`AMBIENTE="staging"` no `wrangler.toml`).
  Para aplicar em produção é obrigatório passar **`prod:true`** explícito — defesa contra apagar
  produção por engano durante um drill.

Parâmetros: `key` (opcional; sem ela, usa o backup **mais recente**), `aplicar` (bool),
`confirmar` (bool), `prod` (bool, só produção).

---

## 4. Drill em staging — procedimento (o ensaio que prova a recuperabilidade)

Pré-requisito: Worker de staging publicado (`wrangler deploy --env staging`) sobre o D1 de staging
(`portal-intelecto-staging`), com o bucket BACKUP de produção reusado (já é o caso no `wrangler.toml`).

1. **Confirme que há ponto de restauração.** No app de staging, logado como dono, rode
   `restore_backup` em **modo verify** (sem `aplicar`). Confira: `disponiveis > 0`, `gerado_em`
   recente, e a lista de tabelas/linhas condizente com a operação.
2. **Reautentique** (a ação é sensível — o front pedirá a senha).
3. **Aplique em staging**: `restore_backup` com `aplicar:true, confirmar:true`. Como
   `AMBIENTE="staging"`, não precisa de `prod`. Guarde o retorno (`restauradas[]`, `falhas[]`).
4. **Verifique as contagens**: para uma amostra de tabelas (ex.: `proj`, `lanc`, `contrato`,
   `fluxo`, `crm_lead`), compare o nº de linhas no D1 de staging com o `linhas` do manifesto do
   passo 1. Devem bater. `falhas` deve estar vazio (uma tabela ausente no schema de staging é
   aceitável e aparece ali — anote).
5. **Fumaça**: abra o portal de staging e confira que telas-chave (Projetos, Financeiro, CRM)
   carregam com o dado restaurado.
6. **Registre o drill**: data, backup usado (`key`/`gerado_em`), total de linhas, tabelas com
   divergência, tempo do passo 3 ao 5 (= RTO medido). Anote no fim deste arquivo (§7).

> O drill **não toca produção**: ele só escreve no D1 de staging. O bucket é lido, nunca escrito.

---

## 5. Recuperação real em produção (incidente)

Só quando houver perda/corrupção confirmada de dados em produção.

1. **Contenha**: avise a equipe, evite novas escritas se possível.
2. **Escolha o backup** (verify em produção): decida entre o mais recente e um anterior ao
   incidente (se a corrupção já entrou no último backup, volte um dia).
3. **Reautentique** e rode `restore_backup` com `aplicar:true, confirmar:true, prod:true`.
4. **Reconstitua a janela de RPO**: o que foi escrito entre o backup e o incidente recarrega-se
   das origens — horas (planilha), caixa (livro-caixa), CRM — e confere-se na trilha de auditoria.
5. **Recarregue a projeção de leads** (`amb_registro`/`amb_agg`) da fonte por `wrangler`, se ela
   também foi afetada — ela não vem do backup (§6).
6. **Pós-incidente**: registre causa, dado perdido efetivo e RTO real; reavalie a frequência do cron.

---

## 6. Por que os leads ambientais ficam fora do backup

`amb_registro` (~151k linhas) e `amb_agg` são **projeção** da Base Empreendimentos MG, recarregada
por `wrangler` a partir dos geradores versionados. Incluí-las no dump tornaria o JSON grande demais
para o Worker **parsear e reinserir** dentro do limite de memória (≈128 MB) — a restauração
falharia justamente no momento em que mais importa. Mantê-las fora deixa o backup pequeno, rápido e
recuperável, sem perda real: elas se reconstroem da fonte. O dado irreparável é o que o backup
carrega.

---

## 7. Registro de drills executados

| Data | Ambiente | Backup (gerado_em) | Linhas | Divergências | RTO medido | Operador | Obs. |
|---|---|---|---|---|---|---|---|
| 2026-10-21 | staging (D1 vazio) | d1/portal-intelecto-2026-10-19.json (2026-10-19T06:00Z) | 6.608 em 29 tabelas | nenhuma (audit +1 = a própria linha do restore) | ~19 s (apply) | Gustavo (conta de teste descartável) | 3 defeitos encontrados e corrigidos (ver §8). amb_registro/amb_agg corretamente fora. Staging zerado após o drill (sem dado/segredo de produção). |

## 8. Achados do primeiro drill (2026-10-21)

O drill cumpriu seu papel: ao exercitar o caminho real pela primeira vez, revelou **três
defeitos** que os testes estáticos não pegavam. Todos corrigidos e revalidados no mesmo drill.

1. **PBKDF2 a 150000 iterações quebrava o login.** O runtime do Cloudflare Workers não deriva
   PBKDF2 acima de 100000 iterações; `hashSenhaNova` gravava 150000, então toda senha criada/
   redefinida pelo app (fluxo H2) ficava impossível de verificar. Corrigido para 100000;
   `verificaSenha` passou a tratar hash legado >100000 como não-verificável (sem estourar).
2. **Restauração estourava o limite de variáveis do D1.** Lotes de INSERT com 40 linhas × colunas
   passavam de ~100 variáveis vinculadas por statement (`too many SQL variables`); só tabelas
   pequenas restauravam. Lote passou a ser dimensionado pelo nº de colunas (linhas×colunas ≤ ~90).
3. **Restauração inteira num único request era cortada.** Centenas de `execute` em sequência
   deixavam o request lento e o Worker era terminado (projx/sess ficavam incompletos). Passou a
   usar D1 `batch()` (~20 statements/round-trip): a restauração completa caiu de >200 s (cortada)
   para **~19 s**.

**Observações operacionais (não-bloqueantes, para acompanhamento):**
- **Frescor do backup:** no dia do drill o backup mais recente no R2 era de **2026-10-19** (2 objetos),
  ou seja ~48 h atrás — não havia backup de 20 nem 21/10. O RPO real depende do cron diário de
  produção estar de fato rodando; convém confirmar o cron `0 6 * * *` em produção (ou rodar
  `backup_now`) e vigiar a idade do backup mais recente.
- **Segredos no backup:** restaurar um backup de produção traz a tabela `config` inteira, que inclui
  hashes de senha (`pin:`), tokens (`mcptokh:`) e e-mails — além de PII do CRM. Em staging isso foi
  transitório (ambiente com Cloudflare Access) e **zerado logo após o drill**. Para drills recorrentes,
  considerar um ambiente isolado descartável ou uma opção de scrub de segredos na restauração.
