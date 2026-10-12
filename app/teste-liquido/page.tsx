import type { Metadata } from "next";
import SoisSymbol from "@/components/SoisSymbol";
import LiquidLabLoader from "@/components/three/liquid/LiquidLabLoader";
import "./lab.css";

export const metadata: Metadata = {
  title: "Sóis · Teste do líquido",
  robots: { index: false },
};

export default function TesteLiquido() {
  return (
    <>
      <header className="nav">
        <a className="nav__brand" href="/" aria-label="Sóis — site atual">
          <SoisSymbol className="nav__symbol" strokeWidth={9} />
          <span>SÓIS</span>
        </a>
        <span className="p3d__badge">Teste do líquido</span>
        <a className="btn btn--small btn--bordo" href="/prototipo-3d">
          Protótipo 3D
        </a>
      </header>
      <main>
        <LiquidLabLoader />
      </main>
    </>
  );
}
