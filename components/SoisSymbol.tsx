// Símbolo oficial da Sóis (dois meios-sóis formando um "S"), geometria em lib/soisSymbol.ts.
// Hastes, arco e raios são traços (animáveis com stroke-dasharray); o crescente do arco é preenchido.
import { bandPath, BOTTOM, STROKE, TOP, VIEWBOX } from "@/lib/soisSymbol";

type Props = {
  className?: string;
  topColor?: string;
  bottomColor?: string;
  strokeWidth?: number;
  title?: string;
};

export default function SoisSymbol({
  className,
  topColor = "var(--laranja)",
  bottomColor = "var(--bordo)",
  strokeWidth = STROKE,
  title = "Símbolo Sóis",
}: Props) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      {(
        [
          ["sun-top", TOP, topColor],
          ["sun-bottom", BOTTOM, bottomColor],
        ] as const
      ).map(([cls, part, color]) => (
        <g key={cls} className={cls} stroke={color} strokeWidth={strokeWidth}>
          <path className="sun-band" d={bandPath(part, strokeWidth / STROKE)} fill={color} stroke="none" />
          <path className="sun-arc" pathLength={1} d={part.arcPath} />
          {part.rays.map(([x1, y1, x2, y2], i) => (
            <line key={i} className="sun-ray" pathLength={1} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
      ))}
    </svg>
  );
}
