"use client";

import { BUCKET, supabaseBrowser } from "@/lib/supabaseBrowser";

export type Assinatura = { path: string; token: string; signedUrl: string };

/**
 * Envia um objeto para uma URL de upload assinada.
 *
 * `uploadToSignedUrl` usa fetch e não expõe progresso, e nestes tamanhos uma
 * espera silenciosa de 30s parece página travada. Então tentamos primeiro via
 * XHR — mesmo endpoint, mesmo corpo — e caímos para o método da biblioteca se
 * qualquer coisa no caminho manual falhar.
 */
export async function enviarObjeto(
  assinatura: Assinatura,
  blob: Blob,
  contentType: string,
  onProgresso?: (fracao: number) => void
): Promise<void> {
  try {
    await viaXhr(assinatura.signedUrl, blob, onProgresso);
    return;
  } catch {
    // segue para o caminho garantido
  }

  const { error } = await supabaseBrowser()
    .storage.from(BUCKET)
    .uploadToSignedUrl(assinatura.path, assinatura.token, blob, {
      contentType,
    });
  if (error) throw error;
}

function viaXhr(
  signedUrl: string,
  blob: Blob,
  onProgresso?: (fracao: number) => void
) {
  return new Promise<void>((ok, falhou) => {
    const corpo = new FormData();
    corpo.append("cacheControl", "3600");
    corpo.append("", blob);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", signedUrl, true);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader(
      "apikey",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
    );

    if (onProgresso) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgresso(e.loaded / e.total);
      };
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? ok()
        : falhou(new Error(`HTTP ${xhr.status}`));
    xhr.onerror = () => falhou(new Error("network"));
    xhr.onabort = () => falhou(new Error("abort"));
    xhr.send(corpo);
  });
}
