"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "fotos";

export const APP_TOKEN = process.env.NEXT_PUBLIC_APP_TOKEN ?? "";

let cliente: SupabaseClient | null = null;

/**
 * Cliente com a chave publicável, usado só para `uploadToSignedUrl`.
 * O token de upload vem do servidor e vale para um único caminho.
 */
export function supabaseBrowser() {
  if (!cliente) {
    cliente = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cliente;
}
