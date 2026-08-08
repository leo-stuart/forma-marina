"use client";

/** iOS zera o toBlob acima disso — o canvas nunca passa daqui. */
const MAX_CANVAS_PX = 16_000_000;

const THUMB_EDGE = 1400;
const THUMB_QUALITY = 0.82;
const CAPTURE_QUALITY = 0.95;

export class ErroDecodificacao extends Error {
  constructor() {
    super("DECODE_FAILED");
  }
}

type Decodificada = {
  fonte: CanvasImageSource;
  width: number;
  height: number;
  liberar: () => void;
};

/**
 * Decodifica sem reescrever nada. `createImageBitmap` roda fora da thread
 * principal e já aplica EXIF; o fallback existe porque uma rejeição dele nem
 * sempre significa "formato ilegível". Os dois falharem sim significa.
 */
async function decodificar(blob: Blob): Promise<Decodificada> {
  try {
    const bmp = await createImageBitmap(blob);
    return {
      fonte: bmp,
      width: bmp.width,
      height: bmp.height,
      liberar: () => bmp.close(),
    };
  } catch {
    // segue para o fallback
  }

  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = "async";
  try {
    await new Promise<void>((ok, falhou) => {
      img.onload = () => ok();
      img.onerror = () => falhou(new ErroDecodificacao()); // HEIC cai aqui
      img.src = url;
    });
    return {
      fonte: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ErroDecodificacao();
  }
}

function desenhar(
  fonte: CanvasImageSource,
  recorte: { sx: number; sy: number; sw: number; sh: number },
  destino: { w: number; h: number },
  espelhar: boolean,
  qualidade: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = destino.w;
  canvas.height = destino.h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("NO_2D_CONTEXT");
  ctx.imageSmoothingQuality = "high";
  if (espelhar) {
    ctx.translate(destino.w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    fonte,
    recorte.sx,
    recorte.sy,
    recorte.sw,
    recorte.sh,
    0,
    0,
    destino.w,
    destino.h
  );

  return new Promise<Blob>((ok, falhou) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = canvas.height = 0; // solta o buffer no iOS
        if (!blob || blob.size === 0) falhou(new Error("ENCODE_FAILED"));
        else ok(blob);
      },
      "image/jpeg",
      qualidade
    );
  });
}

/** Fator que mantém o canvas abaixo do teto do iOS. */
function limitarArea(w: number, h: number) {
  const px = w * h;
  return px <= MAX_CANVAS_PX ? 1 : Math.sqrt(MAX_CANVAS_PX / px);
}

/**
 * Região da fonte que corresponde ao que o `object-fit: cover` mostra numa
 * caixa de proporção `proporcaoCaixa`. Sem isso a foto salva inclui o que o
 * convidado não viu no enquadramento.
 */
export function recorteCover(vw: number, vh: number, proporcaoCaixa: number) {
  let sw = vw;
  let sh = vh;
  if (vw / vh > proporcaoCaixa) sw = Math.round(vh * proporcaoCaixa);
  else sh = Math.round(vw / proporcaoCaixa);
  return {
    sx: Math.round((vw - sw) / 2),
    sy: Math.round((vh - sh) / 2),
    sw,
    sh,
  };
}

/** `videoWidth` só é confiável depois disto (Android às vezes só no `resize`). */
export function esperarQuadro(v: HTMLVideoElement) {
  if (v.videoWidth > 0) return Promise.resolve();
  return new Promise<void>((ok) => {
    const pronto = () => {
      if (v.videoWidth > 0) {
        v.removeEventListener("loadedmetadata", pronto);
        v.removeEventListener("resize", pronto);
        ok();
      }
    };
    v.addEventListener("loadedmetadata", pronto);
    v.addEventListener("resize", pronto);
  });
}

/**
 * Captura o quadro atual da câmera ao vivo. Sempre reescreve — `getUserMedia`
 * entrega quadros de vídeo, não arquivos de câmera —, por isso o botão nativo
 * é o caminho principal para qualidade.
 */
export async function capturarQuadro(
  v: HTMLVideoElement,
  opts: { proporcaoCaixa: number; espelhar: boolean }
): Promise<Blob> {
  if (!v.videoWidth) throw new Error("VIDEO_NOT_READY");
  const recorte = recorteCover(v.videoWidth, v.videoHeight, opts.proporcaoCaixa);
  const fator = limitarArea(recorte.sw, recorte.sh);
  return desenhar(
    v,
    recorte,
    {
      w: Math.max(1, Math.round(recorte.sw * fator)),
      h: Math.max(1, Math.round(recorte.sh * fator)),
    },
    opts.espelhar,
    CAPTURE_QUALITY
  );
}

export type FotoPreparada = {
  original: Blob;
  miniatura: Blob;
  previewUrl: string;
  width: number;
  height: number;
  /** dimensões da miniatura — a galeria reserva espaço com elas */
  thumbWidth: number;
  thumbHeight: number;
};

/**
 * Decodifica uma vez para (a) confirmar que o navegador lê o arquivo — é assim
 * que HEIC é detectado, sem converter nada — e (b) gerar a miniatura da galeria.
 * O `original` sai daqui intacto, byte por byte.
 *
 * Roda logo após a captura, enquanto o convidado confere a foto.
 */
export async function prepararFoto(original: Blob): Promise<FotoPreparada> {
  const { fonte, width, height, liberar } = await decodificar(original);
  try {
    const fator = Math.min(1, THUMB_EDGE / Math.max(width, height));
    const thumbWidth = Math.max(1, Math.round(width * fator));
    const thumbHeight = Math.max(1, Math.round(height * fator));
    const miniatura = await desenhar(
      fonte,
      { sx: 0, sy: 0, sw: width, sh: height },
      { w: thumbWidth, h: thumbHeight },
      false,
      THUMB_QUALITY
    );
    return {
      original,
      miniatura,
      previewUrl: URL.createObjectURL(original),
      width,
      height,
      thumbWidth,
      thumbHeight,
    };
  } finally {
    liberar();
  }
}
