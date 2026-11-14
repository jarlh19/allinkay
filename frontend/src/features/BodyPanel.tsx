import { overallStatus, systemStatus, type SystemStatus } from "../api/liveState";
import type { Evaluation, Mode, System } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { systemKey } from "./signals";
import { StatusChip } from "./StatusChip";

const SYSTEMS: System[] = ["cardiovascular", "neurological", "immune", "environment", "radiation"];
const COLOR: Record<SystemStatus, string> = { ok: "#6fa3d8", warn: "#e3a33b", crit: "#ef5b5b" };

interface Props {
  evaluation: Evaluation | null;
  stormActive: boolean;
  focused: System | "model" | null;
  onFocus: (target: System | "model") => void;
  onMode: (mode: Mode) => void;
}

export function BodyPanel({ evaluation, stormActive, focused, onFocus, onMode }: Props) {
  const { t } = useI18n();
  const status = (system: System): SystemStatus =>
    system === "radiation" && stormActive ? "crit" : systemStatus(evaluation, system);
  const mode = evaluation?.mode ?? "ship";
  const radFocus = focused === "radiation";

  return (
    <section className="panel body-panel">
      <h2>
        {t("body.title")} <StatusChip status={stormActive ? "crit" : overallStatus(evaluation)} />
      </h2>
      <div className="figure">
        <svg viewBox="0 0 300 330" role="img" aria-label={t("body.legend")}>
          <circle cx="150" cy="165" r="146" fill="none" stroke="#233041" strokeWidth="2" strokeDasharray="2 9" />
          <g
            className="zone"
            onClick={() => onFocus("environment")}
            style={{ cursor: "pointer" }}
          >
            <circle cx="150" cy="165" r="128" fill="none" stroke={COLOR[status("environment")]} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="6 6" />
          </g>
          <g fill="none" stroke="#b392f0" strokeLinecap="round" opacity={radFocus ? 1 : 0.75} onClick={() => onFocus("radiation")} style={{ cursor: "pointer" }}>
            <line x1="114" y1="112" x2="92" y2="200" strokeWidth="23.5" />
            <line x1="186" y1="112" x2="208" y2="200" strokeWidth="23.5" />
            <line x1="136" y1="210" x2="132" y2="300" strokeWidth="27.5" />
            <line x1="164" y1="210" x2="168" y2="300" strokeWidth="27.5" />
            <rect x="110" y="96" width="80" height="124" rx="28" strokeWidth="5" />
            <rect x="141" y="80" width="18" height="20" rx="6" strokeWidth="5" />
            <circle cx="150" cy="58" r="27.75" strokeWidth="3.5" />
          </g>
          <g fill="#1d2935" stroke="#3a4b5e" strokeWidth="1.5" strokeLinecap="round">
            <line x1="114" y1="112" x2="92" y2="200" strokeWidth="20" stroke="#1d2935" />
            <line x1="186" y1="112" x2="208" y2="200" strokeWidth="20" stroke="#1d2935" />
            <line x1="136" y1="210" x2="132" y2="300" strokeWidth="24" stroke="#1d2935" />
            <line x1="164" y1="210" x2="168" y2="300" strokeWidth="24" stroke="#1d2935" />
            <rect x="110" y="96" width="80" height="124" rx="28" />
            <rect x="141" y="80" width="18" height="20" rx="6" />
          </g>
          <circle cx="150" cy="58" r="26" fill="#1d2935" stroke={COLOR[status("neurological")]} strokeWidth="2" onClick={() => onFocus("neurological")} style={{ cursor: "pointer" }} />
          <circle cx="136" cy="132" r="13" fill="rgba(111,163,216,.15)" stroke={COLOR[status("cardiovascular")]} strokeWidth="1.5" onClick={() => onFocus("cardiovascular")} style={{ cursor: "pointer" }} />
          <ellipse cx="150" cy="182" rx="24" ry="20" fill="rgba(111,163,216,.1)" stroke={COLOR[status("immune")]} strokeWidth="2" onClick={() => onFocus("immune")} style={{ cursor: "pointer" }} />
          <g fill="#b392f0" stroke="#0e141b" strokeWidth="2" onClick={() => onFocus("radiation")} style={{ cursor: "pointer" }}>
            <circle cx="142" cy="52" r={radFocus ? 7 : 5} />
            <circle cx="160" cy="64" r={radFocus ? 6 : 4} />
            <circle cx="136" cy="132" r={radFocus ? 6 : 4.5} />
            <circle cx="134" cy="252" r={radFocus ? 7 : 5} />
            <circle cx="166" cy="252" r={radFocus ? 7 : 5} />
          </g>
        </svg>
      </div>
      <p className="legend">
        <i />
        {t("body.legend")}
      </p>
      <ul className="systems">
        <li>
          <button type="button" onClick={() => onFocus("model")}>
            <span>{t("body.model")}</span>
            <StatusChip status={overallStatus(evaluation)} />
          </button>
        </li>
        {SYSTEMS.map((system) => (
          <li key={system}>
            <button type="button" onClick={() => onFocus(system)}>
              <span>{t(systemKey(system))}</span>
              <StatusChip status={status(system)} />
            </button>
          </li>
        ))}
      </ul>
      <div className="modes" role="group">
        {(["ship", "field"] as Mode[]).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => onMode(m)}>
            {t(m === "ship" ? "mode.ship" : "mode.field")}
          </button>
        ))}
      </div>
    </section>
  );
}
