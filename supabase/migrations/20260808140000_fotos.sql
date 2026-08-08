-- Fotos dos convidados: bucket privado + tabela de mensagens.
--
-- Rode uma vez. Duas opções:
--   • Dashboard → SQL Editor → cole e execute
--   • supabase db push  (se o projeto estiver linkado pelo CLI)
--
-- É idempotente: rodar de novo não quebra nada.

-- ---------------------------------------------------------------------------
-- 1. Bucket privado das fotos
-- ---------------------------------------------------------------------------
-- 50 MB para caber foto 4K sem recompressão. O limite por bucket nunca pode
-- passar do limite global do projeto (Storage → Settings) — se o global
-- estiver menor, ajuste lá também.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos',
  'fotos',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sem policies em storage.objects de propósito: nada de anônimo lê ou escreve
-- direto. O navegador só sobe via URL assinada, emitida pela rota do servidor
-- com a chave secreta, e válida para um único caminho.

-- ---------------------------------------------------------------------------
-- 2. Tabela das fotos e mensagens
-- ---------------------------------------------------------------------------
create table if not exists public.fotos (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,        -- originais/<id>.<ext> — resolução total
  thumb_path text,                 -- thumbs/<id>.jpg — o que a galeria mostra
  autor      text,
  mensagem   text,                 -- privado: só a Marina lê, aqui no dashboard
  criado_em  timestamptz not null default now()
);

comment on table public.fotos is
  'Fotos enviadas pelos convidados. A coluna mensagem nunca é exposta por nenhuma rota.';

create index if not exists fotos_criado_em_idx
  on public.fotos (criado_em desc);

-- ---------------------------------------------------------------------------
-- 3. RLS: ninguém além da chave secreta
-- ---------------------------------------------------------------------------
-- public está exposto na Data API, então RLS ligado sem nenhuma policy é o que
-- impede anon/authenticated de ler as mensagens. A chave secreta usa
-- service_role (BYPASSRLS) e continua enxergando tudo.
alter table public.fotos enable row level security;

revoke all on public.fotos from anon, authenticated;
