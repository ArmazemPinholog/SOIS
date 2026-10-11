"use client";

import dynamic from "next/dynamic";

// A cena 3D usa canvas/WebGL, então só roda no navegador.
const Experience = dynamic(() => import("./Experience"), {
  ssr: false,
  loading: () => <div className="p3d p3d--loading" aria-hidden="true" />,
});

export default function Prototype() {
  return <Experience />;
}
