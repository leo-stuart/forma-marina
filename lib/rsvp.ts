export type Rsvp = {
  nome: string;
  presenca: string;
  acompanhantes: number;
  nomesAcompanhantes: string[];
  mensagem: string;
  data: string;
};

// URL do App da Web do Google Apps Script (termina em /exec).
// Enquanto vazia, as confirmações caem no armazenamento local/compartilhado.
export const PLANILHA_URL =
  process.env.NEXT_PUBLIC_PLANILHA_URL ??
  "https://script.google.com/macros/s/AKfycbyRYkqERW3Rb2cZf_Eg33Bk6IaBysAwYPC3wRWqSP_wZdewlVWUhFZpwhjM8ovb1jep/exec";

type StorageApi = {
  list?: (prefix: string, shared?: boolean) => Promise<unknown>;
  get?: (key: string, shared?: boolean) => Promise<unknown>;
  set?: (key: string, value: string, shared?: boolean) => Promise<unknown>;
};

function storageApi(): StorageApi | undefined {
  return (window as unknown as { storage?: StorageApi }).storage;
}

export async function lerRsvpsDoStorage(): Promise<Rsvp[]> {
  const registros: Rsvp[] = [];
  const vistos = new Set<string>();
  function add(chave: string, bruto: unknown) {
    if (!bruto || vistos.has(chave)) return;
    try {
      const d = JSON.parse(String(bruto)) as Rsvp;
      if (d && d.nome) {
        registros.push(d);
        vistos.add(chave);
      }
    } catch {
      /* registro corrompido — ignora */
    }
  }

  const storage = storageApi();
  if (storage && storage.list) {
    try {
      const res = (await storage.list("rsvp:", true)) as
        | unknown[]
        | { keys?: unknown[]; items?: unknown[]; entries?: unknown[] }
        | null;
      const itens: unknown[] = Array.isArray(res)
        ? res
        : (res && (res.keys || res.items || res.entries)) || [];
      for (const it of itens) {
        const chave =
          typeof it === "string" ? it : String((it as { key?: string })?.key);
        let valor: unknown =
          it && typeof it === "object" && "value" in it
            ? (it as { value: unknown }).value
            : null;
        if (valor == null && storage.get) {
          const g = await storage.get(chave, true);
          valor =
            g && typeof g === "object" && "value" in g
              ? (g as { value: unknown }).value
              : g;
        }
        add(chave, valor);
      }
    } catch (e) {
      console.error("storage.list falhou", e);
    }
  }

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("rsvp:")) add(k, localStorage.getItem(k));
  }

  registros.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  return registros;
}

export async function salvarRsvpLocal(dados: Rsvp) {
  const key =
    "rsvp:" +
    Date.now() +
    ":" +
    dados.nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
  const storage = storageApi();
  if (storage && storage.set) {
    await storage.set(key, JSON.stringify(dados), true);
  } else {
    // reserva local caso a API de armazenamento não exista
    localStorage.setItem(key, JSON.stringify(dados));
  }
}

export function linhasExport(rsvps: Rsvp[]): string[][] {
  const cab = [
    "Data",
    "Nome",
    "Presença",
    "Acompanhantes",
    "Nomes dos acompanhantes",
    "Mensagem",
  ];
  const linhas = rsvps.map((r) => [
    r.data ? new Date(r.data).toLocaleString("pt-BR") : "",
    r.nome || "",
    r.presenca || "",
    String(r.acompanhantes || 0),
    (r.nomesAcompanhantes || []).join(", "),
    r.mensagem || "",
  ]);
  return [cab].concat(linhas);
}
