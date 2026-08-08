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
const proporcao = (f: Foto) =>
  f.largura && f.altura ? `${f.largura} / ${f.altura}` : "3 / 4";

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

  const vazio = !inicial && fotos.length === 0 && !erro;

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

          {(fotos.length > 0 || carregando) && (
            <div className="look-grid">
              {fotos.map((f) => (
                <figure
                  key={f.id}
                  className="foto-tile"
                  style={{ aspectRatio: proporcao(f) }}
                >
                  <span className="esqueleto-brilho" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt="Foto da festa"
                    loading="lazy"
                    /* classe direto no DOM em vez de estado: com 130 fotos,
                       um setState por imagem carregada re-renderiza a lista
                       inteira 130 vezes */
                    onLoad={(e) =>
                      e.currentTarget.parentElement?.classList.add("carregada")
                    }
                    onError={(e) =>
                      e.currentTarget.parentElement?.classList.add("carregada")
                    }
                  />
                </figure>
              ))}

              {carregando &&
                Array.from({ length: ESQUELETOS }, (_, i) => (
                  <div
                    key={`esqueleto-${i}`}
                    className="foto-tile"
                    style={{ aspectRatio: "3 / 4" }}
                    aria-hidden="true"
                  >
                    <span className="esqueleto-brilho" />
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
