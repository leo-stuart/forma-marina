"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CameraCapture from "@/components/CameraCapture";
import Rails from "@/components/Rails";
import { FotoPreparada } from "@/lib/image";
import { APP_TOKEN } from "@/lib/supabaseBrowser";
import { Assinatura, enviarObjeto } from "@/lib/upload";

function formatarTamanho(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function FotoPage() {
  const [foto, setFoto] = useState<FotoPreparada | null>(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [enviado, setEnviado] = useState(false);

  const fotoRef = useRef<FotoPreparada | null>(null);
  fotoRef.current = foto;

  const autorRef = useRef<HTMLInputElement>(null);

  // Convidados refazem a foto várias vezes — cada preview vira um object URL.
  useEffect(() => {
    return () => {
      if (fotoRef.current) URL.revokeObjectURL(fotoRef.current.previewUrl);
    };
  }, []);

  const trocarFoto = useCallback((nova: FotoPreparada | null) => {
    setFoto((antiga) => {
      if (antiga) URL.revokeObjectURL(antiga.previewUrl);
      return nova;
    });
    setMsg("");
    setErro(false);
  }, []);

  const aviso = useCallback((texto: string) => {
    setMsg(texto);
    setErro(true);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setErro(false);

    if (!foto) {
      aviso("Escolha ou tire uma foto primeiro.");
      return;
    }

    const form = e.currentTarget;
    const autor = (
      form.elements.namedItem("autor") as HTMLInputElement
    ).value.trim();

    // Mesmo padrão do RSVP: valida no envio, explica e leva o foco ao campo —
    // em vez de um botão desabilitado que não diz o que está faltando.
    if (!autor) {
      aviso("Por favor, escreva seu nome antes de enviar.");
      autorRef.current?.focus();
      return;
    }

    setEnviando(true);
    setProgresso(0);
    // A foto sobe em resolução original, então a espera é real — e na 4G da
    // festa dá tempo de o convidado achar que travou e fechar a aba.
    setMsg(
      "Não feche a página. Estamos enviando sua foto — leva só alguns segundos."
    );

    try {
      const resp = await fetch("/api/fotos", {
        method: "POST",
        headers: { "content-type": "application/json", "x-app-token": APP_TOKEN },
        body: JSON.stringify({
          autor,
          contentType: foto.original.type || "image/jpeg",
          tamanho: foto.original.size,
          largura: foto.thumbWidth,
          altura: foto.thumbHeight,
        }),
      });

      if (!resp.ok) {
        const corpo = await resp.json().catch(() => ({}));
        throw new Error(corpo?.erro ?? "Não foi possível enviar.");
      }

      const dados = (await resp.json()) as {
        original: Assinatura;
        miniatura: Assinatura;
      };

      // Original primeiro: se a miniatura falhar, a foto já está salva.
      await enviarObjeto(
        dados.original,
        foto.original,
        foto.original.type || "image/jpeg",
        setProgresso
      );
      await enviarObjeto(dados.miniatura, foto.miniatura, "image/jpeg");

      URL.revokeObjectURL(foto.previewUrl);
      setEnviado(true);
    } catch (err) {
      console.error(err);
      setMsg(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível enviar sua foto. Tente novamente."
      );
      setErro(true);
      setEnviando(false);
    }
  }

  return (
    <>
      <Rails />
      <section className="form-claro pagina-compacta">
        <div className="frame">
          <p className="eyebrow">Para a Marina</p>
          <h2>Mande uma foto</h2>

          {enviado ? (
            <>
              <div className="success-card show">
                <h3>Foto enviada!</h3>
                <p>
                  Obrigado por registrar esse momento. A Marina vai guardar com
                  carinho.
                </p>
              </div>
              <p className="look-cta">
                <Link className="inline-link" href="/galeria">
                  Ver a galeria da festa →
                </Link>
              </p>
            </>
          ) : (
            <>
              <form onSubmit={onSubmit} noValidate>
                <div className="field">
                  <CameraCapture onFoto={trocarFoto} onErro={aviso} />
                </div>

                {foto && (
                  <div className="field">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="previa"
                      src={foto.previewUrl}
                      alt="Prévia da foto escolhida"
                    />
                    <p className="previa-info">
                      {foto.width} × {foto.height} · {formatarTamanho(foto.original.size)}
                    </p>
                    <div className="captura">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => trocarFoto(null)}
                        disabled={enviando}
                      >
                        Refazer
                      </button>
                    </div>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="autor">Seu nome *</label>
                  <input
                    type="text"
                    id="autor"
                    name="autor"
                    autoComplete="name"
                    required
                    maxLength={120}
                    ref={autorRef}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-submit"
                  disabled={enviando || !foto}
                >
                  {enviando
                    ? progresso > 0 && progresso < 1
                      ? `Enviando… ${Math.round(progresso * 100)}%`
                      : "Enviando…"
                    : "Enviar foto"}
                </button>

                {enviando && (
                  <div className="barra" aria-hidden="true">
                    <span style={{ width: `${Math.round(progresso * 100)}%` }} />
                  </div>
                )}

                <p
                  className={
                    "form-msg" + (erro ? " err" : enviando ? " ok" : "")
                  }
                  role="status"
                  aria-live="polite"
                >
                  {msg}
                </p>
              </form>

              <p className="look-cta">
                <Link className="inline-link" href="/galeria">
                  Ver a galeria da festa →
                </Link>
                <br />
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
