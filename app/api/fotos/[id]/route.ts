import { NextResponse } from "next/server";
import { BUCKET, supabaseAdmin, tokenInvalido } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic"; // URLs assinadas expiram — nunca cachear

// Mais curta que a hora da listagem: esta URL só precisa sobreviver ao
// download que começa no clique seguinte.
const VALIDADE = 600;

// O id vem da URL, então chega como texto qualquer. Sem esta checagem um
// "abc" faria o Postgres estourar 22P02 e a rota devolveria 500 no lugar de
// um 400 honesto.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Detalhe de uma foto: o nome de quem enviou e a URL assinada do arquivo
 * original — em resolução total, não a miniatura que a galeria mostra.
 *
 * É a única rota que lê `autor`, e lê uma foto por vez, quando o convidado
 * abre a foto. A listagem em /api/galeria continua sem o campo.
 *
 * Assinar sob demanda, e não junto da lista: o original passa de dezenas de
 * MB e quase nenhuma foto da grade chega a ser aberta.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (tokenInvalido(req)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ erro: "Foto inválida." }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // O filtro por thumb_path repete o da listagem de propósito: uma foto que a
  // galeria esconde (upload interrompido) não pode aparecer por aqui.
  const { data, error } = await supabase
    .from("fotos")
    .select("autor, path")
    .eq("id", id)
    .not("thumb_path", "is", null)
    .maybeSingle();

  if (error) {
    console.error("select em fotos falhou:", error);
    return NextResponse.json({ erro: "Erro ao carregar." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ erro: "Foto não encontrada." }, { status: 404 });
  }

  const { data: assinada, error: erroAssinar } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.path as string, VALIDADE);

  if (erroAssinar || !assinada) {
    console.error("createSignedUrl falhou:", erroAssinar);
    return NextResponse.json({ erro: "Erro ao carregar." }, { status: 500 });
  }

  // Fotos antigas podem não ter autor gravado — devolver null é melhor que
  // uma string vazia, porque o modal decide se mostra a linha ou não.
  return NextResponse.json(
    {
      autor: String(data.autor ?? "").trim() || null,
      url: assinada.signedUrl,
    },
    { headers: { "cache-control": "private, no-store" } }
  );
}
