import type { SystemStatus } from "../api/liveState";
import type { CrewMemberSummary, CrewStatus } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { MESSAGES, type MessageKey } from "../i18n/messages";
import { StatusChip } from "./StatusChip";

const CHIP: Record<CrewStatus, SystemStatus> = { normal: "ok", attention: "warn", emergency: "crit" };

/** The role's name in the current language, or the role itself if there is no translation. */
export function useRoleLabel(): (role: string) => string {
  const { t } = useI18n();
  return (role) => {
    const key = `crew.${role}`;
    return key in MESSAGES.en ? t(key as MessageKey) : role;
  };
}

interface Props {
  members: CrewMemberSummary[];
  selected: string;
  onSelect: (id: string) => void;
}

export function CrewStrip({ members, selected, onSelect }: Props) {
  const { t } = useI18n();
  const roleLabel = useRoleLabel();
  if (members.length === 0) return null;

  return (
    <nav className="crew" aria-label={t("crew.title")}>
      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          className="crew-member"
          aria-pressed={member.id === selected}
          onClick={() => onSelect(member.id)}
        >
          <span className="crew-name">{roleLabel(member.role)}</span>
          <span className="crew-place">{t(member.mode === "ship" ? "mode.ship" : "mode.field")}</span>
          <StatusChip status={CHIP[member.status]} />
        </button>
      ))}
    </nav>
  );
}
