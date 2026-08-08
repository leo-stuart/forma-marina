import { NextResponse } from "next/server";
import { BUCKET, supabaseAdmin, tokenInvalido } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic"; // URLs assinadas expiram — nunca cachear

const VALIDADE = 3600;
const LIMITE_PADRAO = 24;
const LIMITE_MAX = 48;

// O cursor viaja em base64url só para não sofrer com o "+" do fuso na query.
const lerCursor = (c: string | null) => {
  if (!c) return null;
  try {
    const t = Buffer.from(c, "base64url").toString("utf8");
    return Number.isNaN(Date.parse(t)) ? null : t;
  } catch {
    return null;
  }
};
const escreverCursor = (t: string) => Buffer.from(t, "utf8").toString("base64url");

export async function GET(req: Request) {
  if (tokenInvalido(req)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const limite = Math.min(
    LIMITE_MAX,
    Math.max(1, Number(params.get("limite")) || LIMITE_PADRAO)
  );
  const cursor = lerCursor(params.get("cursor"));

  const supabase = supabaseAdmin();

  // Paginação por keyset, não por offset: fotos novas chegam durante a festa e
  // um offset faria o convidado ver repetidas ou pular fotos ao rolar.
  // A lista de colunas continua sendo a garantia de privacidade — `autor` não
  // é lido, então não tem como vazar por aqui.
  let consulta = supabase
    .from("fotos")
    .select("id, thumb_path, largura, altura, criado_em")
    .not("thumb_path", "is", null)
    .order("criado_em", { ascending: false })
    .limit(limite + 1); // +1 só para saber se existe próxima página

  if (cursor) consulta = consulta.lt("criado_em", cursor);

  const { data, error } = await consulta;

  if (error) {
    console.error("select em fotos falhou:", error);
    return NextResponse.json({ erro: "Erro ao carregar." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ fotos: [], proximoCursor: null });
  }

  const temMais = data.length > limite;
  const pagina = temMais ? data.slice(0, limite) : data;

  // Assina só a página — nunca centenas de URLs de uma vez.
  const { data: assinadas, error: erroAssinar } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      pagina.map((f) => f.thumb_path as string),
      VALIDADE
    );

  if (erroAssinar || !assinadas) {
    console.error("createSignedUrls falhou:", erroAssinar);
    return NextResponse.json({ erro: "Erro ao carregar." }, { status: 500 });
  }

  const url = new Map(
    assinadas.filter((a) => !a.error && a.path).map((a) => [a.path!, a.signedUrl])
  );

  // Entradas sem objeto correspondente (upload interrompido) somem em silêncio.
  const fotos = pagina
    .filter((f) => url.get(f.thumb_path as string))
    .map((f) => ({
      id: f.id as string,
      url: url.get(f.thumb_path as string)!,
      largura: (f.largura as number | null) ?? null,
      altura: (f.altura as number | null) ?? null,
      criado_em: f.criado_em as string,
    }));

  // O cursor sai do último item da página, mesmo que ele tenha sido filtrado
  // acima — senão uma foto órfã travaria a rolagem para sempre.
  const ultimo = pagina[pagina.length - 1];

  return NextResponse.json({
    fotos,
    proximoCursor: temMais ? escreverCursor(ultimo.criado_em as string) : null,
  });
}
