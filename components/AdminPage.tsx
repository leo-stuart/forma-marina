"use client";

import { useCallback, useEffect, useState } from "react";
import { lerRsvpsDoStorage, linhasExport, Rsvp } from "@/lib/rsvp";

type Estado = "inicial" | "carregando" | "pronto";

export default function AdminPage({ ativo }: { ativo: boolean }) {
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [estado, setEstado] = useState<Estado>("inicial");
  const [adminMsg, setAdminMsg] = useState("");

  const carregarConfirmacoes = useCallback(async () => {
    setEstado("carregando");
    setRsvps(await lerRsvpsDoStorage());
    setEstado("pronto");
  }, []);

  useEffect(() => {
    if (ativo) carregarConfirmacoes();
  }, [ativo, carregarConfirmacoes]);

  const sim = rsvps.filter((r) => r.presenca === "Sim");
  const nao = rsvps.filter((r) => r.presenca !== "Sim");
  const pessoas = sim.reduce((t, r) => t + 1 + (r.acompanhantes || 0), 0);

  async function copiar() {
    const tsv = linhasExport(rsvps)
      .map((l) => l.map((c) => c.replace(/[\t\n\r]+/g, " ")).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setAdminMsg(
        "Copiado! Cole na primeira célula do Google Sheets (Ctrl+V / Cmd+V)."
      );
    } catch {
      setAdminMsg(
        "Não consegui copiar automaticamente — use o botão Baixar CSV."
      );
    }
  }

  function baixarCsv() {
    const csv =
      "﻿" +
      linhasExport(rsvps)
        .map((l) => l.map((c) => '"' + c.replace(/"/g, '""') + '"').join(","))
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "confirmacoes-formatura-marina.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section id="adminPage">
      <div className="frame">
        <a className="inline-link" href="#">
          ← Voltar ao convite
        </a>
        <p className="eyebrow" style={{ marginTop: "clamp(40px, 7vh, 64px)" }}>
          Área da Marina
        </p>
        <h2>Confirmações recebidas</h2>

        <div className="admin-totais" id="adminTotais">
          {estado === "pronto" && (
            <>
              <div className="tot">
                <div className="n">{pessoas}</div>
                <div className="t">Pessoas na festa</div>
              </div>
              <div className="tot">
                <div className="n">{sim.length}</div>
                <div className="t">Confirmaram</div>
              </div>
              <div className="tot">
                <div className="n">{nao.length}</div>
                <div className="t">Não vão</div>
              </div>
            </>
          )}
        </div>
        <div className="admin-tools">
          <button type="button" className="btn" id="btnCopiar" onClick={copiar}>
            Copiar para o Google Sheets
          </button>
          <button
            type="button"
            className="btn ghost"
            id="btnCsv"
            onClick={baixarCsv}
          >
            Baixar CSV
          </button>
          <button
            type="button"
            className="btn ghost"
            id="btnRecarregar"
            onClick={carregarConfirmacoes}
          >
            Atualizar lista
          </button>
        </div>
        <p
          className="form-msg"
          id="adminMsg"
          role="status"
          aria-live="polite"
          style={{ color: "var(--sky-deep)", marginBottom: "18px" }}
        >
          {adminMsg}
        </p>

        <div className="tabela-wrap">
          <table id="adminTabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Presença</th>
                <th>Acomp.</th>
                <th>Nomes dos acompanhantes</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {estado === "carregando" && (
                <tr>
                  <td colSpan={6} className="admin-vazio">
                    Carregando…
                  </td>
                </tr>
              )}
              {estado === "pronto" && rsvps.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-vazio">
                    Nenhuma confirmação ainda.
                  </td>
                </tr>
              )}
              {estado === "pronto" &&
                rsvps.map((r, i) => (
                  <tr key={i}>
                    <td className="num">
                      {r.data
                        ? new Date(r.data).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </td>
                    <td>{r.nome}</td>
                    <td
                      className={
                        r.presenca === "Sim" ? "presenca-sim" : "presenca-nao"
                      }
                    >
                      {r.presenca}
                    </td>
                    <td className="num">{r.acompanhantes || 0}</td>
                    <td>{(r.nomesAcompanhantes || []).join(", ")}</td>
                    <td>{r.mensagem}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
