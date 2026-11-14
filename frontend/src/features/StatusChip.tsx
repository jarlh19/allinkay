import type { SystemStatus } from "../api/liveState";
import { useI18n } from "../i18n/i18n";

export function StatusChip({ status, label }: { status: SystemStatus; label?: string }) {
  const { t } = useI18n();
  return <span className={`status ${status}`}>{label ?? t(`status.${status}`)}</span>;
}
