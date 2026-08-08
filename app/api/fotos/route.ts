import { NextResponse } from "next/server";
import { BUCKET, supabaseAdmin, tokenInvalido } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const TAMANHO_MAX = 50 * 1024 * 1024;

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

/**
 * Não recebe a foto — só emite as credenciais de upload.
 *
 * Vercel limita corpo de request a 4,5 MB e isso não é configurável, então uma
 * foto 4K nunca poderia passar por aqui. Os bytes vão direto do navegador para
 * o Supabase; a chave secreta fica no servidor e serve para assinar os
 * caminhos, cada token valendo para um único objeto.
 */
export async function POST(req: Request) {
  if (tokenInvalido(req)) return erro("Não autorizado.", 401);

  let corpo: {
    autor?: unknown;
    mensagem?: unknown;
    contentType?: unknown;
    tamanho?: unknown;
    largura?: unknown;
    altura?: unknown;
  };
  try {
    corpo = await req.json();
  } catch {
    return erro("Requisição inválida.", 400);
  }

  const contentType = String(corpo.contentType ?? "");
  const ext = TIPOS[contentType];
  if (!ext) return erro("Formato de imagem não suportado.", 400);

  const tamanho = Number(corpo.tamanho ?? 0);
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > TAMANHO_MAX) {
    return erro("A foto precisa ter até 50 MB.", 400);
  }

  const autor = String(corpo.autor ?? "").trim().slice(0, 120);
  const mensagem = String(corpo.mensagem ?? "").trim().slice(0, 1000);

  // Dimensões da miniatura: opcionais, mas sem elas a galeria não consegue
  // reservar espaço antes da imagem chegar.
  const dimensao = (v: unknown) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 && n <= 20000 ? n : null;
  };
  const largura = dimensao(corpo.largura);
  const altura = dimensao(corpo.altura);

  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const path = `originais/${id}.${ext}`;
  const thumbPath = `thumbs/${id}.jpg`;

  const supabase = supabaseAdmin();

  const [original, miniatura] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUploadUrl(path),
    supabase.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
  ]);

  if (original.error || !original.data) {
    console.error("createSignedUploadUrl (original) falhou:", original.error);
    return erro("Não foi possível preparar o envio.", 500);
  }
  if (miniatura.error || !miniatura.data) {
    console.error("createSignedUploadUrl (miniatura) falhou:", miniatura.error);
    return erro("Não foi possível preparar o envio.", 500);
  }

  // A linha entra antes de qualquer byte subir: se algo falhar depois, o que se
  // perde é a foto, nunca a mensagem da Marina.
  const { error: erroInsert } = await supabase
    .from("fotos")
    .insert({ path, thumb_path: thumbPath, largura, altura, autor, mensagem });

  if (erroInsert) {
    console.error("insert em fotos falhou:", erroInsert);
    return erro("Não foi possível registrar sua mensagem.", 500);
  }

  return NextResponse.json({
    original: { path, token: original.data.token, signedUrl: original.data.signedUrl },
    miniatura: {
      path: thumbPath,
      token: miniatura.data.token,
      signedUrl: miniatura.data.signedUrl,
    },
  });
}
