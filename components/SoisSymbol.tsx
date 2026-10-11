// Símbolo provisório da Sóis (dois meios-sóis formando um "S").
// Substituir pelo SVG oficial da marca quando o arquivo vetorial chegar (dados em lib/soisSymbol.ts).
import { BOTTOM, TOP, VIEWBOX } from "@/lib/soisSymbol";

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
  strokeWidth = 5,
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
          <path className="sun-arc" pathLength={1} d={part.arcPath} />
          {part.rays.map(([x1, y1, x2, y2], i) => (
            <line key={i} className="sun-ray" pathLength={1} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
      ))}
    </svg>
  );
}
