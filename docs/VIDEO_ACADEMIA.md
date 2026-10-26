# Hospedagem de vídeo da Academia (D-5)

## Decisão: R2 servido pelo Worker (com Stream como upgrade)

A aula de vídeo da Academia tem **dois caminhos**, escolhidos pelo autor:

1. **Embed externo** (`url`): YouTube, Vimeo, Google Drive. Custo zero de hospedagem; sai do portal.
2. **Self-hosted no R2** (`video_key`): o arquivo vive no bucket `portal-intelecto-video` e é servido
   de forma **privada e gated** pela rota `GET /academia/video/:aula`, com **HTTP Range** (seek e
   streaming progressivo). É o caminho recomendado para conteúdo interno que não deve sair do portal.

**Por que R2 e não Cloudflare Stream, agora:**
- A Academia é **interna** (equipe pequena, atrás do Cloudflare Access). Download progressivo de MP4
  do R2 é adequado para esse público; não precisamos de bitrate adaptativo.
- **Reusa o padrão que já existe** (Acervo/Vitrine servem arquivos privados do R2 pelo Worker) — zero
  serviço pago novo, zero billing por minuto, e replicável para outra empresa (meta de MVP).
- O **gate** é o mesmo do resto: login + curso publicado (ou coordenação). A chave vem do banco, nunca
  do cliente (sem path injection).

**Quando migrar para Cloudflare Stream (upgrade documentado, não feito):**
- Se os vídeos ficarem grandes/numerosos e precisarem de **bitrate adaptativo** (HLS/DASH) para redes
  ruins, ou **audiência externa grande**, ou **upload in-app de arquivos grandes** (o Stream tem
  _direct creator upload_ + transcodificação). Nesse caso, troca-se `video_key` (R2) por um
  `stream_uid` e o player passa a usar o player do Stream. A rota e o schema atuais ficam como estão
  para os vídeos já hospedados no R2.

## Como publicar um vídeo self-hosted

1. Crie o bucket uma vez (se ainda não existe):
   ```
   npx wrangler r2 bucket create portal-intelecto-video
   ```
2. Suba o arquivo (MP4 recomendado; webm/ogg/mov também servem), escolhendo uma **chave** estável:
   ```
   npx wrangler r2 object put portal-intelecto-video/cursos/<curso>/<aula>.mp4 --file ./aula.mp4 --remote
   ```
3. Na casca nova: **Academia › (curso) › Autoria › aula tipo `video`** → campo **"Vídeo hospedado
   (chave no R2)"** = `cursos/<curso>/<aula>.mp4`. Salve. O player passa a tocar embutido, com seek.

> Upload direto pela interface (sem wrangler) é uma fatia futura: exige _presigned PUT_ do R2 ou
> _direct upload_ do Stream, por causa do limite de corpo de requisição do Worker para arquivos grandes.

## Operação

- Serviço: `GET /academia/video/:aula` — deriva a chave da aula no banco, valida login + curso
  publicado (coordenação vê rascunho), e responde `206 Partial Content` a requisições com `Range`
  (ou `200` com `Accept-Ranges: bytes`). `Cache-Control: private`. Não entra na trilha de auditoria
  (Range gera muitos hits por reprodução).
- Schema: `curso_aula.video_key` (migração 0009 + ALTER idempotente no ensureSchema; `SCHEMA_VER`
  bumpado para disparar). `url` segue para embeds externos.
- Binding: `VIDEO` → `portal-intelecto-video` (prod e staging no `wrangler.toml`).
