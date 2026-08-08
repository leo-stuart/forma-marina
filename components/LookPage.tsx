const looks = [
  { src: "/images/look-1.jpg", alt: "Inspiração de look feminino" },
  { src: "/images/look-2.jpg", alt: "Inspiração de look masculino" },
  { src: "/images/look-3.jpg", alt: "Inspiração de look feminino" },
  { src: "/images/look-4.jpg", alt: "Inspiração de looks" },
  { src: "/images/look-5.jpg", alt: "Inspiração de look feminino" },
  { src: "/images/look-6.jpg", alt: "Inspiração de look masculino" },
];

export default function LookPage() {
  return (
    <section id="lookPage">
      <div className="frame">
        <a className="inline-link" href="#" id="voltarLink">
          ← Voltar ao convite
        </a>
        <p className="eyebrow" style={{ marginTop: "clamp(40px, 7vh, 64px)" }}>
          Guia de estilo
        </p>
        <h2>Inspirações para o seu look</h2>

        <div className="look-grid">
          {looks.map((look) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={look.src} src={look.src} alt={look.alt} loading="lazy" />
          ))}
        </div>
      </div>
    </section>
  );
}
