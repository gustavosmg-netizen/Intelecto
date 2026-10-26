-- 0009 — D-5: vídeo self-hosted da Academia. A aula passa a guardar a CHAVE do objeto no bucket R2
-- VIDEO (servido com Range pela rota GET /academia/video/:aula). Espelha o ALTER idempotente do
-- ensureSchema. `url` segue existindo para embeds externos (YouTube/Vimeo/Drive).
ALTER TABLE curso_aula ADD COLUMN video_key TEXT DEFAULT '';
