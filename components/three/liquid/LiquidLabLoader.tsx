"use client";

import dynamic from "next/dynamic";

// WebGL só roda no navegador.
const LiquidLab = dynamic(() => import("./LiquidLab"), {
  ssr: false,
  loading: () => <div className="lab lab--loading" aria-hidden="true" />,
});

export default function LiquidLabLoader() {
  return <LiquidLab />;
}
