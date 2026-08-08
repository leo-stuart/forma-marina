import Link from "next/link";
import QRCode from "qrcode";
import Rails from "@/components/Rails";

export const metadata = { title: "QR — Mande uma foto" };

/**
 * O QR vai ser impresso e colado na mesa — não pode apontar para uma URL
 * efêmera. `VERCEL_URL` é o endereço daquele deploy específico
 * (convite-marina-r4qhaevdo-….vercel.app), que muda a cada publicação e foi o
 * que gerou o QR errado. `VERCEL_PROJECT_PRODUCTION_URL` é o domínio estável
 * de produção, então vem antes dele.
 */
function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function QrPage() {
  const alvo = `${baseUrl().replace(/\/$/, "")}/foto`;
  const svg = await QRCode.toString(alvo, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <>
      <Rails />
      <section className="qr-page">
        <div className="frame">

          <div className="qr-card">
            <p className="eyebrow">Formatura da Marina</p>
            <h2>Tire uma foto e mande para a Marina</h2>
            <div
              className="qr-code"
              aria-label={`QR code para ${alvo}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="qr-url">{alvo}</p>
          </div>

          <p className="qr-dica nao-imprimir">
            Use Cmd+P (ou Ctrl+P) para imprimir este cartão para as mesas.
          </p>
        </div>
      </section>
    </>
  );
}
