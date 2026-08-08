import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave secreta — ignora RLS. Só pode ser usado em route handlers.
 * A chave nunca tem prefixo NEXT_PUBLIC_, então nunca chega ao navegador.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SECRET_KEY no ambiente."
    );
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Portão compartilhado das rotas. O token vai para o navegador de propósito
 * (convidados anônimos precisam enviar fotos), então barra curl casual —
 * não é segurança. A proteção real é a chave secreta ficar no servidor.
 */
export function tokenInvalido(req: Request) {
  const enviado = req.headers.get("x-app-token");
  const esperado = process.env.NEXT_PUBLIC_APP_TOKEN;
  return !esperado || enviado !== esperado;
}

export const BUCKET = "fotos";
