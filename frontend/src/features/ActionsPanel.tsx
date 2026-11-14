import { useState } from "react";

import type { Evaluation } from "../api/types";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { AlertCard } from "./ModelPanel";

type Open = "guide" | "routine" | null;

const STORM_STEPS: MessageKey[] = ["guide.storm.1", "guide.storm.2", "guide.storm.3", "guide.storm.4"];
const GENERAL_STEPS: MessageKey[] = [
  "guide.general.1",
  "guide.general.2",
  "guide.general.3",
  "guide.general.4",
];

export function ActionsPanel({ evaluation }: { evaluation: Evaluation | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Open>(null);
  const alerts = evaluation?.alerts ?? [];
  const storm = alerts.some((a) => a.kind === "solar_storm");
  const mitigation = (evaluation?.mitigation ?? "mitigation.ship_routines") as MessageKey;
  const attention = alerts.filter((a) => a.level === "attention");

  return (
    <div>
      <div className="modes" style={{ paddingTop: 0, gridTemplateColumns: "1fr 1fr" }}>
        <button type="button" aria-pressed={open === "guide"} onClick={() => setOpen(open === "guide" ? null : "guide")}>
          {t("actions.guide")} · {t("actions.guideSub")}
        </button>
        <button type="button" aria-pressed={open === "routine"} onClick={() => setOpen(open === "routine" ? null : "routine")}>
          {t("actions.routine")} · {t(mitigation)}
        </button>
      </div>
      {open === "guide" && (
        <div className="alert crit" style={{ marginTop: 14 }}>
          <span className="icon">✕</span>
          <div>
            <strong>{storm ? t("guide.stormTitle") : t("guide.generalTitle")}</strong>
            <ol style={{ paddingLeft: 18, marginTop: 6 }}>
              {(storm ? STORM_STEPS : GENERAL_STEPS).map((step) => (
                <li key={step} style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 4 }}>
                  {t(step)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      {open === "routine" &&
        (attention.length > 0 ? (
          attention.map((alert, i) => <AlertCard key={`${alert.kind}-${i}`} alert={alert} />)
        ) : (
          <p className="note" style={{ marginTop: 14 }}>
            {t("routine.empty")}
          </p>
        ))}
    </div>
  );
}
