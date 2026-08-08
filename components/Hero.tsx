"use client";

import { useEffect, useState } from "react";

// contagem regressiva (diferença entre datas de calendário)
function contagem(): string | null {
  const hoje = new Date();
  const meiaNoiteHoje = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  );
  const meiaNoiteFesta = new Date(2026, 7, 8); // 08/08/2026
  const days = Math.round(
    (meiaNoiteFesta.getTime() - meiaNoiteHoje.getTime()) / 86400000
  );
  if (days > 1) return "Faltam " + days + " dias";
  if (days === 1) return "É amanhã!";
  if (days === 0) return "É hoje!";
  return null;
}

export default function Hero() {
  const [countdown, setCountdown] = useState<string | null>(contagem);

  useEffect(() => {
    setCountdown(contagem());
  }, []);

  return (
    <header className="hero">
      <div className="hero-photo" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero.jpg" alt="" />
      </div>
      <div className="hero-scrim" aria-hidden="true"></div>

      <div className="masthead frame">
        <h1>Marina se Formou</h1>
        <p className="sub">Venha comemorar conosco!</p>
      </div>

      <div className="hero-body frame">
        <div className="cover-date">
          <div className="num">08</div>
          <div className="caption">
            de agosto
            <br />
            de 2026
          </div>
          <div className="rule" aria-hidden="true"></div>
          {countdown !== null && (
            <p className="countdown" id="countdown" suppressHydrationWarning>
              {countdown}
            </p>
          )}
        </div>
      </div>

      <div className="cover-foot frame">
        <div>
          <p className="hours">
            17 <small>às</small> 22 <small>horas</small>
          </p>
          <p className="rsvp-note">RSVP até dia 15 de julho de 2026</p>
          <div className="cta-row">
            <a className="btn" href="#rsvp">
              Confirmar presença
            </a>
            <a className="btn ghost" href="#detalhes">
              Ver detalhes
            </a>
          </div>
        </div>
        <p className="addr">
          Rua Rodrigues Caldas, 470
          <br />
          Salão de Festas
          <br />
          Santo Agostinho, Belo Horizonte/MG
        </p>
      </div>
    </header>
  );
}
