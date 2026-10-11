import type { Metadata } from "next";
import SmoothScroll from "@/components/SmoothScroll";
import SoisSymbol from "@/components/SoisSymbol";
import Prototype from "@/components/three/Prototype";
import "./p3d.css";

export const metadata: Metadata = {
  title: "Sóis · Protótipo 3D",
  robots: { index: false },
};

export default function Prototipo3D() {
  return (
    <>
      <SmoothScroll />
      <header className="nav">
        <a className="nav__brand" href="/" aria-label="Sóis — site atual">
          <SoisSymbol className="nav__symbol" strokeWidth={9} />
          <span>SÓIS</span>
        </a>
        <span className="p3d__badge">Protótipo 3D</span>
        <a className="btn btn--small btn--bordo" href="/">
          Ver site atual
        </a>
      </header>
      <main>
        <Prototype />
        <section className="p3d-end">
          <p className="kicker">Fim do protótipo</p>
          <h2 className="display">
            Próximo passo:
            <br />
            <em>moer e passar.</em>
          </h2>
        </section>
      </main>
    </>
  );
}
