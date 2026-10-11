// Símbolo provisório da Sóis (dois meios-sóis formando um "S").
// Substituir pelo SVG oficial da marca quando o arquivo vetorial chegar.

type Props = {
  className?: string;
  topColor?: string;
  bottomColor?: string;
  strokeWidth?: number;
  title?: string;
};

const TOP_RAYS = [
  [78.5, 133.24, 65.5, 155.76],
  [68.62, 125.39, 56.94, 136.33],
  [61.43, 115.02, 38.12, 126.52],
  [57.57, 103.0, 41.79, 105.61],
  [57.37, 90.39, 31.59, 86.99],
  [60.83, 78.25, 46.26, 71.65],
  [67.67, 67.65, 48.12, 50.51],
  [77.29, 59.48, 68.84, 45.9],
  [88.87, 54.47, 82.14, 29.35],
];

const BOTTOM_RAYS = [
  [111.13, 122.47, 117.86, 97.35],
  [122.71, 127.48, 131.16, 113.9],
  [132.33, 135.65, 151.88, 118.51],
  [139.17, 146.25, 153.74, 139.65],
  [142.63, 158.39, 168.41, 154.99],
  [142.43, 171.0, 158.21, 173.61],
  [138.57, 183.02, 161.88, 194.52],
  [131.38, 193.39, 143.06, 204.33],
  [121.5, 201.24, 134.5, 223.76],
];

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
      viewBox="0 0 200 264"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      <g className="sun-top" stroke={topColor} strokeWidth={strokeWidth}>
        <path className="sun-arc" pathLength={1} d="M111.63 18 L111.63 64.05 A34 34 0 1 0 100 130" />
        {TOP_RAYS.map(([x1, y1, x2, y2], i) => (
          <line key={i} className="sun-ray" pathLength={1} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <g className="sun-bottom" stroke={bottomColor} strokeWidth={strokeWidth}>
        <path className="sun-arc" pathLength={1} d="M100 130 A34 34 0 0 1 88.37 195.95 L88.37 246" />
        {BOTTOM_RAYS.map(([x1, y1, x2, y2], i) => (
          <line key={i} className="sun-ray" pathLength={1} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  );
}
