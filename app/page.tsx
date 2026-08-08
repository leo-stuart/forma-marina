"use client";

import AdminPage from "@/components/AdminPage";
import Detalhes from "@/components/Detalhes";
import Hero from "@/components/Hero";
import LookPage from "@/components/LookPage";
import Rails from "@/components/Rails";
import Rodape from "@/components/Rodape";
import RsvpSection from "@/components/RsvpSection";
import { useHashRoute } from "@/lib/useHashRoute";
import { useReveal } from "@/lib/useReveal";

export default function Page() {
  const hash = useHashRoute();
  useReveal();

  return (
    <>
      <Rails />

      <Hero />
      <Detalhes />
      <RsvpSection />
      <Rodape />

      <LookPage />
      <AdminPage ativo={hash === "#confirmacoes"} />
    </>
  );
}
