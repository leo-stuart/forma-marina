-- Galeria paginada (keyset) + rolagem infinita.
--
-- Depende de 20260808140000_fotos.sql. Idempotente: rodar de novo não quebra.
--
--   Dashboard → SQL Editor → cole e execute
--   ou: supabase db push

-- ---------------------------------------------------------------------------
-- 1. Dimensões da miniatura
-- ---------------------------------------------------------------------------
-- A galeria usa <img loading="lazy"> dentro de um grid de colunas CSS. Sem
-- width/height, a imagem ocupa altura zero até carregar: o grid colapsa, a
-- sentinela da rolagem infinita nunca sai da tela e o navegador puxa todas as
-- páginas de uma vez — justamente o que a paginação existe para evitar.
-- Guardar as dimensões deixa o navegador reservar o espaço antes do download
-- e ainda elimina o pulo de layout conforme as fotos chegam.
alter table public.fotos add column if not exists largura int;
alter table public.fotos add column if not exists altura  int;

comment on column public.fotos.largura is
  'Largura da miniatura em px. Reserva espaço no grid antes do carregamento.';
comment on column public.fotos.altura is
  'Altura da miniatura em px.';

-- ---------------------------------------------------------------------------
-- 2. Índice no formato exato da consulta da galeria
-- ---------------------------------------------------------------------------
--   select ... from fotos
--   where thumb_path is not null [and criado_em < cursor]
--   order by criado_em desc limit N
--
-- Índice parcial: linhas sem miniatura nunca aparecem na galeria e só
-- ocupariam espaço. Como a paginação é por keyset (criado_em < cursor) e não
-- por offset, toda página custa o mesmo — o banco não relê o que já passou,
-- que é o que degradaria conforme as fotos se acumulam na festa.
create index if not exists fotos_galeria_idx
  on public.fotos (criado_em desc)
  where thumb_path is not null;

-- O índice antigo vira redundante: o novo cobre a mesma ordenação.
drop index if exists public.fotos_criado_em_idx;
