import type { Forecast } from "../api/types";
import { useI18n } from "../i18n/i18n";

const W = 360;
const H = 170;
const PAD = { left: 36, right: 10, top: 14, bottom: 26 };

export function ForecastChart({ forecast }: { forecast: Forecast | null }) {
  const { t } = useI18n();
  if (!forecast || forecast.points.length === 0) {
    return <p className="note">{t("forecast.waiting")}</p>;
  }
  const history = forecast.history;
  const points = forecast.points;
  const all = [
    ...history,
    ...points.flatMap((p) => [p.low, p.high]),
    ...(forecast.normal_low !== null ? [forecast.normal_low] : []),
    ...(forecast.normal_high !== null ? [forecast.normal_high] : []),
  ];
  const min = Math.floor(Math.min(...all) - 0.3);
  const max = Math.ceil(Math.max(...all) + 0.3);
  const count = history.length + points.length;
  const x = (i: number) => PAD.left + (i / (count - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + ((max - v) / (max - min)) * (H - PAD.top - PAD.bottom);
  const last = history.length - 1;
  const past = history.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const ahead = [`${x(last)},${y(history[last] ?? 0)}`, ...points.map((p, i) => `${x(last + i + 1)},${y(p.value)}`)].join(" ");
  const band = [
    `${x(last)},${y(history[last] ?? 0)}`,
    ...points.map((p, i) => `${x(last + i + 1)},${y(p.high)}`),
    ...[...points].reverse().map((p, i) => `${x(last + points.length - i)},${y(p.low)}`),
  ].join(" ");
  const ticks = [min, Math.round((min + max) / 2), max];
  const final = points[points.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("forecast.aria")} style={{ width: "100%", height: "auto" }}>
        {forecast.normal_low !== null && forecast.normal_high !== null && (
          <rect
            x={PAD.left}
            y={y(forecast.normal_high)}
            width={W - PAD.left - PAD.right}
            height={y(forecast.normal_low) - y(forecast.normal_high)}
            fill="rgba(111,163,216,.10)"
          />
        )}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#233041" />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize="12" fill="#7d8da0">
              {tick.toFixed(0)} h
            </text>
          </g>
        ))}
        <polygon points={band} fill="rgba(227,163,59,.16)" />
        <polyline points={past} fill="none" stroke="#6fa3d8" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={ahead} fill="none" stroke="#e3a33b" strokeWidth="2" strokeDasharray="5 4" />
        {history.map((v, i) => (
          <circle key={`h${i}`} cx={x(i)} cy={y(v)} r="4" fill={forecast.normal_low !== null && v < forecast.normal_low ? "#e3a33b" : "#6fa3d8"} stroke="#141c25" strokeWidth="1.5">
            <title>{`${v.toFixed(1)} h`}</title>
          </circle>
        ))}
        {points.map((p, i) => (
          <circle key={`p${i}`} cx={x(last + i + 1)} cy={y(p.value)} r="4" fill="#141c25" stroke="#e3a33b" strokeWidth="1.5">
            <title>{`${p.value.toFixed(1)} h (${p.low.toFixed(1)}–${p.high.toFixed(1)})`}</title>
          </circle>
        ))}
        <text x={x(last)} y={H - 6} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="12" fill="#a3b2c2">
          {t("forecast.today")}
        </text>
        <text x={x(count - 1)} y={H - 6} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize="12" fill="#e3a33b">
          +{points.length}
        </text>
      </svg>
      <p className="legend" style={{ gap: 14, flexWrap: "wrap", margin: "6px 0" }}>
        <span>— {t("forecast.measured")}</span>
        <span style={{ color: "var(--warn)" }}>- - {t("forecast.predicted")}</span>
        <span>▭ {t("forecast.normalBand")}</span>
      </p>
      {final && (
        <p className="note">
          {t("forecast.summary", { nights: points.length, value: final.value.toFixed(1), low: final.low.toFixed(1), high: final.high.toFixed(1) })}
        </p>
      )}
    </div>
  );
}
