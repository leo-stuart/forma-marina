"use client";

import { useEffect, useState } from "react";

// rotas das subpáginas (#look, #confirmacoes)
export function useHashRoute() {
  const [hash, setHash] = useState("");

  useEffect(() => {
    function route() {
      const atual = location.hash;
      setHash(atual);

      const look = atual === "#look";
      const admin = atual === "#confirmacoes";
      document.body.classList.toggle("look-open", look);
      document.body.classList.toggle("admin-open", admin);

      if (look || admin) {
        window.scrollTo(0, 0);
      } else if (atual.length > 1) {
        // alvo estava oculto quando o hash mudou — rola manualmente
        const alvo = document.querySelector(atual);
        if (alvo) alvo.scrollIntoView();
      }
    }

    window.addEventListener("hashchange", route);
    route();
    return () => window.removeEventListener("hashchange", route);
  }, []);

  return hash;
}
