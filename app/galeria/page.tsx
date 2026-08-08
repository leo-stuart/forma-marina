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

          {inicial && <p className="admin-vazio">Carregando…</p>}
          {vazio && (
            <p className="admin-vazio">Nenhuma foto ainda. Seja o primeiro!</p>
          )}

          {fotos.length > 0 && (
            /* Filhos <img> diretos: as regras miram `.look-grid img`, e um
               wrapper quebraria o break-inside das colunas. */
            <div className="look-grid">
              {fotos.map((f) => (
                /* width/height reservam o espaço antes do download: sem eles o
                   grid colapsa e a sentinela puxa todas as páginas de uma vez */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={f.id}
                  src={f.url}
                  alt="Foto da festa"
                  loading="lazy"
                  width={f.largura ?? undefined}
                  height={f.altura ?? undefined}
                />
              ))}
            </div>
          )}

          {/* Alvo do observer: precisa existir no DOM antes do fim da lista. */}
          <div ref={sentinelaRef} aria-hidden="true" />

          {carregando && !inicial && (
            <p className="galeria-status">Carregando mais…</p>
          )}

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
