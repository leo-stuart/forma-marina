"use client";

import { useRef, useState } from "react";
import { PLANILHA_URL, Rsvp, salvarRsvpLocal } from "@/lib/rsvp";

export default function RsvpSection() {
  const [presenca, setPresenca] = useState("Sim");
  const [nomesAcomp, setNomesAcomp] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<{
    titulo: string;
    texto: string;
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const acompRefs = useRef<(HTMLInputElement | null)[]>([]);
  const successRef = useRef<HTMLDivElement>(null);

  function ajustarQuantidade(n: number) {
    setNomesAcomp((atuais) =>
      Array.from({ length: n }, (_, i) => atuais[i] || "")
    );
  }

  function trocarPresenca(valor: string) {
    setPresenca(valor);
    if (valor === "Não") setNomesAcomp([]);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setErro(false);

    const form = e.currentTarget;
    const nome = (form.elements.namedItem("nome") as HTMLInputElement).value.trim();
    if (!nome) {
      setMsg("Por favor, preencha seu nome.");
      setErro(true);
      nomeRef.current?.focus();
      return;
    }

    const nomes = nomesAcomp.map((v) => v.trim());
    const vazio = nomes.findIndex((v) => !v);
    if (presenca === "Sim" && vazio !== -1) {
      setMsg("Por favor, preencha o nome de todos os acompanhantes.");
      setErro(true);
      acompRefs.current[vazio]?.focus();
      return;
    }

    const mensagem = (
      form.elements.namedItem("mensagem") as HTMLTextAreaElement
    ).value.trim();

    const dados: Rsvp = {
      nome,
      presenca,
      acompanhantes: presenca === "Sim" ? nomes.length : 0,
      nomesAcompanhantes: presenca === "Sim" ? nomes : [],
      mensagem,
      data: new Date().toISOString(),
    };

    setEnviando(true);

    try {
      let salvoNaPlanilha = false;
      if (PLANILHA_URL) {
        try {
          // corpo como string simples evita preflight de CORS
          const resp = await fetch(PLANILHA_URL, {
            method: "POST",
            body: JSON.stringify(dados),
          });
          salvoNaPlanilha =
            resp.ok ||
            resp.type === "opaque" ||
            resp.type === "opaqueredirect";
        } catch (err) {
          console.error("Falha ao enviar para a planilha:", err);
        }
      }
      if (!salvoNaPlanilha) await salvarRsvpLocal(dados);

      const primeiroNome = nome.split(" ")[0];
      setSucesso(
        presenca === "Não"
          ? {
              titulo: "Que pena!",
              texto:
                "Obrigado por avisar, " +
                primeiroNome +
                ". Você fará falta — a Marina agradece o carinho. 💙",
            }
          : {
              titulo: "Presença confirmada!",
              texto:
                "Obrigado, " +
                primeiroNome +
                "! A Marina vai adorar ter você lá. Até o dia 08 de agosto! 🎓",
            }
      );
      requestAnimationFrame(() =>
        successRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      );
    } catch (err) {
      console.error(err);
      setMsg("Não foi possível enviar sua confirmação. Tente novamente.");
      setErro(true);
      setEnviando(false);
    }
  }

  return (
    <section id="rsvp" className="rsvp">
      <div className="frame reveal">
        <p className="eyebrow">Confirmação de presença</p>
        <h2>Você vem?</h2>
        {!sucesso && (
          <p className="deadline">Confirme até 15 de julho de 2026</p>
        )}

        {!sucesso && (
          <form id="rsvpForm" ref={formRef} noValidate onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="nome">Seu nome completo *</label>
              <input
                type="text"
                id="nome"
                name="nome"
                autoComplete="name"
                required
                ref={nomeRef}
              />
            </div>

            <div className="field">
              <label id="presencaLabel">Você vai comparecer? *</label>
              <div
                className="attendance"
                role="radiogroup"
                aria-labelledby="presencaLabel"
              >
                <input
                  type="radio"
                  id="sim"
                  name="presenca"
                  value="Sim"
                  checked={presenca === "Sim"}
                  onChange={() => trocarPresenca("Sim")}
                />
                <label className="pill" htmlFor="sim">
                  Sim, estarei lá!
                </label>
                <input
                  type="radio"
                  id="nao"
                  name="presenca"
                  value="Não"
                  checked={presenca === "Não"}
                  onChange={() => trocarPresenca("Não")}
                />
                <label className="pill" htmlFor="nao">
                  Infelizmente não
                </label>
              </div>
            </div>

            <div
              className="field"
              id="acompField"
              style={presenca === "Não" ? { display: "none" } : undefined}
            >
              <label htmlFor="acompanhantes">Número de acompanhantes</label>
              <select
                id="acompanhantes"
                name="acompanhantes"
                value={String(nomesAcomp.length)}
                onChange={(e) => ajustarQuantidade(Number(e.target.value))}
              >
                <option value="0">Vou sozinho(a)</option>
                <option value="1">+1 acompanhante</option>
                <option value="2">+2 acompanhantes</option>
                <option value="3">+3 acompanhantes</option>
                <option value="4">+4 acompanhantes</option>
              </select>
            </div>

            <div id="acompNomes">
              {presenca !== "Não" &&
                nomesAcomp.map((valor, i) => (
                  <div className="field" key={i}>
                    <label htmlFor={"acomp" + i}>
                      {"Nome do acompanhante " + (i + 1) + " *"}
                    </label>
                    <input
                      type="text"
                      id={"acomp" + i}
                      required
                      value={valor}
                      ref={(el) => {
                        acompRefs.current[i] = el;
                      }}
                      onChange={(e) =>
                        setNomesAcomp((atuais) =>
                          atuais.map((v, j) => (j === i ? e.target.value : v))
                        )
                      }
                    />
                  </div>
                ))}
            </div>

            <div className="field">
              <label htmlFor="mensagem">
                Deixe uma mensagem para a Marina (opcional)
              </label>
              <textarea id="mensagem" name="mensagem" maxLength={500} />
            </div>

            <button
              type="submit"
              className="btn btn-submit"
              id="submitBtn"
              disabled={enviando}
            >
              {enviando ? "Enviando…" : "Confirmar"}
            </button>
            <p
              className={"form-msg" + (erro ? " err" : "")}
              id="formMsg"
              role="status"
              aria-live="polite"
            >
              {msg}
            </p>
          </form>
        )}

        <div
          className={"success-card" + (sucesso ? " show" : "")}
          id="successCard"
          ref={successRef}
        >
          <h3 id="successTitle">
            {sucesso ? sucesso.titulo : "Presença confirmada!"}
          </h3>
          <p id="successText">{sucesso ? sucesso.texto : ""}</p>
        </div>

        <p className="look-cta">
          <a className="inline-link" href="#look">
            Inspirações para o seu look →
          </a>
        </p>
      </div>
    </section>
  );
}
