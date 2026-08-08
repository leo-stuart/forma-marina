-- Autor visível na foto aberta.
--
-- Depende de 20260808180000_remover_mensagem.sql. Idempotente.
--
--   Dashboard → SQL Editor → cole e execute
--   ou: supabase db push
--
-- Nada de schema muda aqui. O que muda é o contrato: 20260808180000 dizia que
-- `autor` nunca saía de rota nenhuma, e a partir da foto aberta na galeria ele
-- sai — uma foto por vez, em GET /api/fotos/[id], quando o convidado clica.
-- A listagem de /api/galeria continua sem ler a coluna, de propósito: um
-- fetch só não pode virar a lista de nomes da festa inteira.

comment on table public.fotos is
  'Fotos enviadas pelos convidados. A coluna autor sai só em /api/fotos/[id], '
  'uma foto por vez, junto da URL do original — nunca na listagem de /api/galeria.';
