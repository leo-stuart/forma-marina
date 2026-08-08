"use client";

import { useEffect, useRef, useState } from "react";
import { APP_TOKEN } from "@/lib/supabaseBrowser";

type Props = {
  /** A miniatura que a grade já baixou — não precisa vir da rede de novo. */
  foto: { id: string; url: string };
  aoFechar: () => void;
};

type Detalhe = { autor: string | null; url: string };
type Fase = "buscando" | "baixando" | "pronta" | "falhou";

/**
 * Foto aberta sobre a galeria, em resolução total e com o nome de quem tirou.
 *
 * `<dialog>` nativo com showModal(), não uma div fixa: prender o foco, fechar
 * no Esc, marcar o resto da página como inerte e devolver o foco ao botão que
 * abriu vêm prontos do navegador. E o top layer passa por cima dos trilhos
 * (`.rails`, z-index 60) sem precisar inventar número maior.
 */
export default function FotoModal({ foto, aoFechar }: Props) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [fase, setFase] = useState<Fase>("buscando");

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return;

    // A devolução do foco que o close() faz sozinho não vale aqui: quem fecha
    // é o React, desmontando o elemento, e um <dialog> já solto do documento
    // não devolve foco nenhum. Guardar o alvo na mão é o que faz o Tab
    // continuar de onde parou na grade.
    const anterior = document.activeElement as HTMLElement | null;

    // showModal() e não o atributo `open`: o atributo dá um dialog NÃO-modal,
    // sem top layer, sem backdrop e sem armadilha de foco.
    dialogo.showModal();

    // O modal nativo não trava a rolagem de trás — o Safari rola o fundo.
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = rolagem;
      if (dialogo.open) dialogo.close();
      // isConnected: se a foto sumiu da grade no meio do caminho, focar um nó
      // solto joga o foco no body — melhor deixar como está.
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    fetch(`/api/fotos/${foto.id}`, {
      headers: { "x-app-token": APP_TOKEN },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Detalhe) => {
        setDetalhe(d);
        setFase("baixando");
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        console.error("Falha ao abrir a foto:", e);
        setFase("falhou");
      });

    return () => ctrl.abort();
  }, [foto.id]);

  return (
    <dialog
      ref={dialogoRef}
      className="foto-modal"
      aria-label="Foto da festa em tamanho real"
      /* Esc dispara `cancel`. O React é quem desmonta, então o fechamento
         automático do navegador é barrado para os dois não brigarem. */
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
    >
      {/* O palco ocupa a tela toda; ::backdrop não é elemento e nunca recebe
          clique, então é aqui que o clique fora chega. A checagem de
          currentTarget garante que só o vazio ao redor fecha. */}
      <div
        className="foto-modal-palco"
        onClick={(e) => {
          if (e.target === e.currentTarget) aoFechar();
        }}
      >
        <button
          type="button"
          className="foto-modal-fechar"
          /* showModal() foca o primeiro autofocus: a primeira parada do Tab
             vira algo que faz sentido. */
          autoFocus
          onClick={aoFechar}
        >
          Fechar
        </button>

        <figure className="foto-modal-quadro">
          {/* A miniatura é quem dimensiona o quadro — tem dimensão intrínseca
              e já está no cache do navegador, então pinta no mesmo quadro do
              clique. Nada pula quando o original chega por cima.
              Sem desfoque de propósito: a miniatura tem 1400px de lado maior,
              borrar só pioraria o caso comum para dramatizar o raro. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="foto-modal-previa"
            src={foto.url}
            alt=""
            aria-hidden="true"
          />

          {detalhe && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className={
                fase === "pronta"
                  ? "foto-modal-cheia pronta"
                  : "foto-modal-cheia"
              }
              src={detalhe.url}
              alt="Foto da festa"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setFase("pronta")}
              onError={() => setFase("falhou")}
            />
          )}
        </figure>

        <div className="foto-modal-legenda">
          {detalhe?.autor && (
            <>
              <span className="foto-modal-rotulo">Enviada por</span>
              <p className="foto-modal-autor">{detalhe.autor}</p>
            </>
          )}

          {(fase === "buscando" || fase === "baixando") && (
            <p className="foto-modal-carga" role="status" aria-live="polite">
              Carregando o original
              <span className="foto-modal-barra" aria-hidden="true" />
            </p>
          )}

          {fase === "falhou" && (
            <p className="foto-modal-carga">
              Não deu para carregar o original.
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
