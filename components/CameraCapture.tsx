"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  capturarQuadro,
  ErroDecodificacao,
  esperarQuadro,
  FotoPreparada,
  prepararFoto,
} from "@/lib/image";

/** Proporção da caixa do visor. O recorte da captura acompanha. */
const PROPORCAO = 3 / 4;

type Motivo =
  | "insecure"
  | "unsupported"
  | "denied"
  | "busy"
  | "none"
  | "other";

type Estado =
  | { k: "idle" }
  | { k: "requesting" }
  | { k: "live" }
  | { k: "unavailable"; motivo: Motivo };

const RECADOS: Record<Motivo, string> = {
  insecure:
    "A câmera ao vivo precisa de HTTPS. Use o botão “Tirar foto” acima.",
  unsupported:
    "Este navegador não abre a câmera ao vivo. Use o botão “Tirar foto” acima.",
  denied:
    "Não conseguimos abrir a câmera. Se você veio pelo WhatsApp, toque em ⋯ e escolha “Abrir no Safari” — ou use o botão “Tirar foto” acima.",
  busy: "A câmera está sendo usada por outro app. Feche-o e tente de novo.",
  none: "Nenhuma câmera encontrada neste aparelho.",
  other: "Não foi possível abrir a câmera. Use o botão “Tirar foto” acima.",
};

function motivoDoErro(e: unknown): Motivo {
  const nome = (e as { name?: string })?.name;
  if (nome === "NotAllowedError" || nome === "SecurityError") return "denied";
  if (nome === "NotFoundError" || nome === "OverconstrainedError") return "none";
  if (nome === "NotReadableError" || nome === "AbortError") return "busy";
  return "other";
}

export default function CameraCapture({
  onFoto,
  onErro,
}: {
  onFoto: (foto: FotoPreparada) => void;
  onErro: (mensagem: string) => void;
}) {
  const [estado, setEstado] = useState<Estado>({ k: "idle" });
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [temDuas, setTemDuas] = useState(false);
  const [processando, setProcessando] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Só limpeza. Iniciar a câmera num efeito faria o StrictMode do React abrir
  // duas capturas, e o WebKit mata a primeira quando a segunda começa — o visor
  // fica preto apenas em desenvolvimento.
  useEffect(() => pararStream, [pararStream]);

  // O WebKit pausa o vídeo ao ir para segundo plano e nem sempre retoma.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && streamRef.current) {
        videoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);

  const preparar = useCallback(
    async (blob: Blob) => {
      setProcessando(true);
      try {
        onFoto(await prepararFoto(blob));
      } catch (e) {
        if (e instanceof ErroDecodificacao) {
          onErro(
            "Não conseguimos ler essa foto (provavelmente HEIC). No iPhone: Ajustes → Câmera → Formatos → Mais Compatível, ou tire a foto direto por aqui."
          );
        } else {
          onErro("Não foi possível processar essa foto. Tente outra.");
        }
      } finally {
        setProcessando(false);
      }
    },
    [onFoto, onErro]
  );

  // Sempre dentro do clique: resolve o gesto exigido pelo iOS e a permissão.
  const ligar = useCallback(
    async (comFacing: "user" | "environment") => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setEstado({ k: "unavailable", motivo: "insecure" });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado({ k: "unavailable", motivo: "unsupported" });
        return;
      }

      pararStream(); // nunca deixar duas capturas se sobrepondo no iOS
      setEstado({ k: "requesting" });

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // valor simples = "ideal": `exact` estoura em notebook de uma câmera só
          video: {
            facingMode: comFacing,
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
      } catch (e) {
        setEstado({ k: "unavailable", motivo: motivoDoErro(e) });
        return;
      }

      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop()); // desmontou durante o await
        return;
      }
      streamRef.current = stream;
      setFacing(comFacing);

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setEstado({ k: "unavailable", motivo: "busy" });
      });

      v.muted = true; // propriedades, não atributos JSX
      v.playsInline = true;
      v.srcObject = stream;
      await v.play().catch(() => {});
      await esperarQuadro(v);
      setEstado({ k: "live" });

      // Só depois da permissão os dispositivos ficam visíveis. Usado apenas
      // para decidir se o botão de virar aparece — a troca é por facingMode,
      // porque desde o iOS 16.3 cada lente traseira é um device separado.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setTemDuas(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch {
        setTemDuas(false);
      }
    },
    [pararStream]
  );

  const disparar = useCallback(async () => {
    const v = videoRef.current;
    if (!v || estado.k !== "live") return;
    try {
      const blob = await capturarQuadro(v, {
        proporcaoCaixa: PROPORCAO,
        espelhar: facing === "user",
      });
      pararStream(); // apaga o indicador laranja enquanto escrevem a mensagem
      setEstado({ k: "idle" });
      await preparar(blob);
    } catch {
      onErro("Não foi possível capturar a foto. Tente de novo.");
    }
  }, [estado.k, facing, pararStream, preparar, onErro]);

  const aoEscolherArquivo = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // permite reescolher o mesmo arquivo
      if (file) await preparar(file);
    },
    [preparar]
  );

  return (
    <div className="captura">
      {/* Sempre montado: o <label> aponta para ele por htmlFor. */}
      <input
        id="arquivoFoto"
        className="input-arquivo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={aoEscolherArquivo}
        disabled={processando}
      />

      {/* Com a câmera ligada as opções de entrada saem de cena: o visor vira o
          único assunto da tela, como num app de câmera. */}
      {estado.k !== "live" && (
        <div className="captura-acoes">
          {/* Caminho principal: app nativo da câmera, arquivo em resolução
              total, e o único que funciona no navegador do WhatsApp. */}
          <label className="btn" htmlFor="arquivoFoto">
            {processando ? "Preparando…" : "Escolher foto"}
          </label>
          <button
            type="button"
            className="btn ghost"
            onClick={() => ligar(facing)}
            disabled={estado.k === "requesting" || processando}
          >
            {estado.k === "requesting" ? "Abrindo…" : "Usar câmera ao vivo"}
          </button>
        </div>
      )}

      {/* O <video> fica sempre no DOM, mas a caixa do visor só aparece com o
          stream resolvido — visor renderizado por otimismo vira retângulo preto. */}
      <div className={"visor" + (estado.k === "live" ? " ativo" : "")}>
        <video
          ref={videoRef}
          className={facing === "user" ? "espelhado" : undefined}
          autoPlay
          playsInline
          muted
        />
      </div>

      {estado.k === "live" && (
        /* grade 1fr / auto / 1fr: o obturador fica centrado no visor mesmo
           quando não há botão de virar câmera */
        <div className="camera-controles">
          {temDuas ? (
            <button
              type="button"
              className="camera-secundario"
              onClick={() =>
                ligar(facing === "environment" ? "user" : "environment")
              }
            >
              Virar
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            className="obturador"
            onClick={disparar}
            aria-label="Capturar foto"
          />

          <button
            type="button"
            className="camera-secundario"
            onClick={() => {
              pararStream();
              setEstado({ k: "idle" });
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {estado.k === "unavailable" && (
        <p className="captura-aviso">{RECADOS[estado.motivo]}</p>
      )}
    </div>
  );
}
