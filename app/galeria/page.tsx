"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Rails from "@/components/Rails";
import { APP_TOKEN } from "@/lib/supabaseBrowser";

type Foto = {
  id: string;
  url: string;
  largura: number | null;
  altura: number | null;
  criado_em: string;
};
type Resposta = { fotos: Foto[]; proximoCursor: string | null };

/** Quantos placeholders mostrar enquanto uma página está a caminho. */
const ESQUELETOS = 6;

/** Fotos antigas não têm dimensões gravadas — 3/4 é o retrato típico. */
const RAZAO_PADRAO = 4 / 3;

const proporcao = (f: Foto) =>
  f.largura && f.altura ? `${f.largura} / ${f.altura}` : "3 / 4";

/** Altura relativa a uma coluna de largura 1. */
const razao = (f: Foto) =>
  f.largura && f.altura ? f.altura / f.largura : RAZAO_PADRAO;

type Item =
  | { tipo: "foto"; chave: string; foto: Foto }
  | { tipo: "esqueleto"; chave: string };

/**
 * Distribuição estilo Pinterest: cada item vai para a coluna mais curta no
 * momento. Um grid CSS não serve aqui porque alinha linhas — uma foto baixa
 * ao lado de uma alta deixa um buraco embaixo dela até a linha seguinte.
 *
 * As alturas saem das dimensões já gravadas no banco, então isso roda na
 * renderização, sem medir o DOM nem esperar as imagens carregarem.
 */
function distribuir(itens: Item[], colunas: number): Item[][] {
  const baldes: Item[][] = Array.from({ length: colunas }, () => []);
  const alturas = new Array<number>(colunas).fill(0);

  for (const item of itens) {
    let menor = 0;
    for (let i = 1; i < colunas; i++) {
      if (alturas[i] < alturas[menor]) menor = i;
    }
    baldes[menor].push(item);
    alturas[menor] +=
      item.tipo === "foto" ? razao(item.foto) : RAZAO_PADRAO;
  }
  return baldes;
}

export default function GaleriaPage() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [inicial, setInicial] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [fim, setFim] = useState(false);

  const cursorRef = useRef<string | null>(null);
  const ocupadoRef = useRef(false); // evita disparos concorrentes do observer
  const vistosRef = useRef(new Set<string>());
  const sentinelaRef = useRef<HTMLDivElement>(null);

  const carregarMais = useCallback(async () => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setCarregando(true);
    setErro(false);

    try {
      const params = new URLSearchParams();
      if (cursorRef.current) params.set("cursor", cursorRef.current);

      const resp = await fetch(`/api/galeria?${params}`, {
        headers: { "x-app-token": APP_TOKEN },
      });
      if (!resp.ok) throw new Error(String(resp.status));

      const dados = (await resp.json()) as Resposta;

      // Dedupe por id: fotos novas podem chegar entre uma página e outra.
      const novas = (dados.fotos ?? []).filter((f) => !vistosRef.current.has(f.id));
      novas.forEach((f) => vistosRef.current.add(f.id));

      if (novas.length) setFotos((atuais) => atuais.concat(novas));
      cursorRef.current = dados.proximoCursor;
      if (!dados.proximoCursor) setFim(true);
    } catch (e) {
      console.error("Falha ao carregar a galeria:", e);
      setErro(true);
    } finally {
      setCarregando(false);
      setInicial(false);
      ocupadoRef.current = false;
    }
  }, []);

  useEffect(() => {
    carregarMais();
  }, [carregarMais]);

  // rootMargin generoso: a próxima página começa a chegar antes de o convidado
  // encostar no fim, então a rolagem não engasga.
  useEffect(() => {
    const alvo = sentinelaRef.current;
    if (!alvo || fim || erro) return;

    if (!("IntersectionObserver" in window)) {
      setFim(true); // sem observer, o botão manual assume
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) carregarMais();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(alvo);
    return () => io.disconnect();
  }, [carregarMais, fim, erro, fotos.length]);

  // 2 colunas no celular, 3 a partir de 900px — o mesmo ponto de quebra que o
  // resto do site usa. Precisa ser JS porque a distribuição depende da contagem.
  const [colunas, setColunas] = useState(2);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const aplicar = () => setColunas(mq.matches ? 3 : 2);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  const vazio = !inicial && fotos.length === 0 && !erro;

  const itens: Item[] = [
    ...fotos.map((f) => ({ tipo: "foto" as const, chave: f.id, foto: f })),
    ...(carregando
      ? Array.from({ length: ESQUELETOS }, (_, i) => ({
          tipo: "esqueleto" as const,
          chave: `esqueleto-${i}`,
        }))
      : []),
  ];
  const baldes = distribuir(itens, colunas);

  return (
    <>
      <Rails />
      <section className="pagina-compacta">
        <div className="frame">
          <p className="eyebrow">Da festa</p>
          <h2>Galeria</h2>

          {vazio && (
            <p className="admin-vazio">Nenhuma foto ainda. Seja o primeiro!</p>
          )}

          {itens.length > 0 && (
            <div className="look-grid">
              {baldes.map((balde, i) => (
                <div className="galeria-coluna" key={`coluna-${i}`}>
                  {balde.map((item) =>
                    item.tipo === "foto" ? (
                      <figure
                        key={item.chave}
                        className="foto-tile"
                        style={{ aspectRatio: proporcao(item.foto) }}
                      >
                        <span className="esqueleto-brilho" aria-hidden="true" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.foto.url}
                          alt="Foto da festa"
                          loading="lazy"
                          /* classe direto no DOM em vez de estado: com 130
                             fotos, um setState por imagem carregada
                             re-renderiza a lista inteira 130 vezes */
                          onLoad={(e) =>
                            e.currentTarget.parentElement?.classList.add(
                              "carregada"
                            )
                          }
                          onError={(e) =>
                            e.currentTarget.parentElement?.classList.add(
                              "carregada"
                            )
                          }
                        />
                      </figure>
                    ) : (
                      <div
                        key={item.chave}
                        className="foto-tile"
                        style={{ aspectRatio: "3 / 4" }}
                        aria-hidden="true"
                      >
                        <span className="esqueleto-brilho" />
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}

          {carregando && (
            <p className="galeria-status" role="status" aria-live="polite">
              Carregando fotos…
            </p>
          )}

          {/* Alvo do observer: precisa existir no DOM antes do fim da lista. */}
          <div ref={sentinelaRef} aria-hidden="true" />

          {erro && (
            <p className="galeria-status">
              Não foi possível carregar
              {fotos.length > 0 ? " mais fotos" : " as fotos"}.{" "}
              <button
                type="button"
                className="inline-link como-link"
                onClick={carregarMais}
              >
                Tentar de novo
              </button>
            </p>
          )}

          {fim && fotos.length > 0 && (
            <p className="galeria-status">Isso é tudo por enquanto.</p>
          )}

          <p className="look-cta">
            <Link className="inline-link" href="/foto">
              Mandar uma foto →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
