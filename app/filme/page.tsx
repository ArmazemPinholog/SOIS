import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import Film from "@/components/film/Film";

export const metadata: Metadata = {
  title: "Sóis Café · Goa — filme (versão anterior do hero)",
  robots: { index: false },
};

export default function FilmePage() {
  return <HomePage hero={<Film />} />;
}
