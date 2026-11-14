import { overallStatus, systemStatus, type SystemStatus } from "../api/liveState";
import type { Evaluation, Radiation, System } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { systemKey } from "./signals";
import { StatusChip } from "./StatusChip";

export type Target = System | "model";

const SYSTEMS: System[] = ["cardiovascular", "neurological", "immune", "environment", "radiation"];

/** Share of the signals that are inside the person's normal right now. */
function inNormal(evaluation: Evaluation | null, system?: System): { n: number; total: number } {
  const deviations = (evaluation?.deviations ?? []).filter((d) => !system || d.system === system);
  return { n: deviations.filter((d) => !d.outside_normal).length, total: deviations.length };
}

function Ring({ share, status }: { share: number; status: SystemStatus }) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 36 36" className="ring" aria-hidden="true">
      <circle className="ring-track" cx="18" cy="18" r={radius} />
      <circle
        className={`ring-arc ${status}`}
        cx="18"
        cy="18"
        r={radius}
        strokeDasharray={`${share * length} ${length}`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

interface Props {
  evaluation: Evaluation | null;
  radiation: Radiation | null;
  focused: Target | null;
  onFocus: (target: Target) => void;
}

export function StatusColumn({ evaluation, radiation, focused, onFocus }: Props) {
  const { t } = useI18n();
  const storm = radiation?.storm_active ?? false;
  const statusOf = (target: Target): SystemStatus => {
    if (target === "model") return overallStatus(evaluation);
    if (target === "radiation" && storm) return "crit";
    return systemStatus(evaluation, target);
  };
  const summaryOf = (target: Target): string => {
    if (target === "radiation" && radiation) {
      return t("summary.dose", { percent: Math.round(radiation.career_fraction * 100) });
    }
    const { n, total } = inNormal(evaluation, target === "model" ? undefined : target);
    return total === 0 ? t("summary.waiting") : t("summary.inNormal", { n, total });
  };
  // The ring shows what the summary says: share in the normal, or for radiation the dose used.
  const shareOf = (target: Target): number => {
    if (target === "radiation" && radiation) return Math.min(radiation.career_fraction, 1);
    const { n, total } = inNormal(evaluation, target === "model" ? undefined : target);
    return total === 0 ? 0 : n / total;
  };
  const targets: Target[] = ["model", ...SYSTEMS];

  return (
    <section className="panel status-column" aria-labelledby="status-title">
      <h2 id="status-title">
        {t("body.title")} <StatusChip status={storm ? "crit" : overallStatus(evaluation)} />
      </h2>
      <ul>
        {targets.map((target) => (
          <li key={target}>
            <button
              type="button"
              className="status-item"
              aria-current={focused === target ? "true" : undefined}
              aria-controls={`panel-${target}`}
              onClick={() => onFocus(target)}
            >
              <Ring share={shareOf(target)} status={statusOf(target)} />
              <span>
                <span className="status-name">{t(target === "model" ? "body.model" : systemKey(target))}</span>
                <span className="status-summary">{summaryOf(target)}</span>
              </span>
              <StatusChip status={statusOf(target)} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
