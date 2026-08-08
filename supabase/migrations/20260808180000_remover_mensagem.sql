-- Remove a mensagem escrita da foto.
--
-- Depende de 20260808140000_fotos.sql e 20260808173000_galeria_paginada.sql.
-- Idempotente: rodar de novo não quebra.
--
--   Dashboard → SQL Editor → cole e execute
--   ou: supabase db push
--
-- ATENÇÃO: destrutivo. Qualquer mensagem já enviada por um convidado some e
-- não tem como voltar. O campo `autor` continua existindo e sendo gravado.

alter table public.fotos drop column if exists mensagem;

-- O comentário da tabela, definido em 20260808140000, citava a coluna que
-- acabou de sair. Agora quem precisa ficar fora das rotas é só o `autor`.
comment on table public.fotos is
  'Fotos enviadas pelos convidados. A coluna autor nunca é exposta por nenhuma rota.';
