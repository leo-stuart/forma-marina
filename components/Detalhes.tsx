export default function Detalhes() {
  return (
    <section id="detalhes" className="frame reveal">
      <p className="eyebrow">O grande dia</p>
      <h2>Detalhes da celebração</h2>
      <div className="details-grid">
        <div className="detail">
          <p className="label">Data</p>
          <p className="value">
            Sábado, <span className="accent">08 de agosto</span> de 2026
          </p>
          <a
            className="inline-link"
            href="https://www.google.com/calendar/render?action=TEMPLATE&text=Formatura+da+Marina&dates=20260808T200000Z/20260809T010000Z&details=Venha+comemorar+conosco!&location=Rua+Rodrigues+Caldas,+470+-+Salão+de+Festas,+Santo+Agostinho,+Belo+Horizonte/MG"
            target="_blank"
            rel="noopener"
          >
            Adicionar à agenda →
          </a>
        </div>
        <div className="detail">
          <p className="label">Horário</p>
          <p className="value">
            Das <span className="accent">17h às 22h</span>
          </p>
        </div>
        <div className="detail">
          <p className="label">Local</p>
          <p className="value">
            Salão de Festas
            <br />
            Rua Rodrigues Caldas, 470
            <br />
            Santo Agostinho — Belo Horizonte/MG
          </p>
          <a
            className="inline-link"
            href="https://www.google.com/maps/search/?api=1&query=Rua+Rodrigues+Caldas+470+Santo+Agostinho+Belo+Horizonte"
            target="_blank"
            rel="noopener"
          >
            Ver no mapa →
          </a>
        </div>
        <div className="detail">
          <p className="label">Confirmação</p>
          <p className="value">
            RSVP até <span className="accent">15 de julho de 2026</span>
          </p>
          <a className="inline-link" href="#rsvp">
            Confirmar agora →
          </a>
        </div>
      </div>
    </section>
  );
}
