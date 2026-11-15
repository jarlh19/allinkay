/**
 * The points of a small line chart: each value placed between the lowest and the highest of the
 * series, left to right, inside a `width` × `height` box with `pad` pixels kept free on every side.
 * A flat series sits in the middle.
 */
export function sparkPoints(values: number[], width: number, height: number, pad = 3): [number, number][] {
  if (values.length === 0) return [];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low;
  const step = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  return values.map((value, i) => {
    const x = values.length > 1 ? pad + i * step : width / 2;
    const y = span === 0 ? height / 2 : height - pad - ((value - low) / span) * (height - 2 * pad);
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  });
}

const WIDTH = 150;
const HEIGHT = 30;

/** A line of the latest values with a dot on the last one; decorative, the value is written next to it. */
export function Sparkline({ values, tone }: { values: number[]; tone: "pulse" | "sleep" }) {
  const points = sparkPoints(values, WIDTH, HEIGHT);
  const last = points[points.length - 1];
  return (
    <svg className={`sparkline ${tone}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
      {points.length > 1 && <polyline points={points.map(([x, y]) => `${x},${y}`).join(" ")} />}
      {last && <circle cx={last[0]} cy={last[1]} r="3" />}
    </svg>
  );
}
