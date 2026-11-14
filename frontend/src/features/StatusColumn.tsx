import type { CrewMemberSummary, Evaluation, Radiation } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { useRoleLabel } from "./CrewStrip";
import { Ring } from "./Ring";
import { StatusChip } from "./StatusChip";
import { inNormal, targetShare, targetStatus } from "./statusSummary";

interface Props {
  evaluation: Evaluation | null;
  radiation: Radiation | null;
  member: CrewMemberSummary | undefined;
  memberNumber: number;
  connected: boolean;
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** Left column: who is being watched and how many of their signals are in their normal. */
export function StatusColumn({ evaluation, radiation, member, memberNumber, connected }: Props) {
  const { t } = useI18n();
  const roleLabel = useRoleLabel();
  const role = member ? roleLabel(member.role) : "";
  const status = targetStatus("model", evaluation, radiation);
  const { n, total } = inNormal(evaluation);
  const percent = total === 0 ? null : Math.round((n / total) * 100);

  return (
    <div className="status-column">
      <section className="panel crew-card" aria-labelledby="crew-card-name">
        <span className="avatar" aria-hidden="true">
          {initials(role)}
        </span>
        <div>
          <h2 id="crew-card-name">{role}</h2>
          <p className="crew-card-line">
            {t("crewcard.member", { n: memberNumber })}
            {member && ` · ${t(member.mode === "ship" ? "mode.ship" : "mode.field")}`}
          </p>
          <p className={`crew-card-live${connected ? "" : " off"}`}>
            <i aria-hidden="true" />
            {t(connected ? "crewcard.live" : "crewcard.offline")}
          </p>
        </div>
      </section>
      <section className="panel overall-card" aria-labelledby="status-title">
        <h2 id="status-title">
          {t("body.title")} <StatusChip status={status} />
        </h2>
        <div className="overall-ring">
          <Ring share={targetShare("model", evaluation, radiation)} status={status} size={148}>
            <strong>{percent === null ? "–" : `${percent}%`}</strong>
            <span>{t("overall.inNormal")}</span>
          </Ring>
        </div>
        <p className="note overall-note">
          {total === 0 ? t("summary.waiting") : t("overall.signals", { n, total })}
        </p>
      </section>
    </div>
  );
}
