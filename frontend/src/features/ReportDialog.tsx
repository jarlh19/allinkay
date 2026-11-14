import { useState, type FormEvent } from "react";

import type { Mode } from "../api/types";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";

export const SCREENS = [
  "overall",
  "cardiovascular",
  "neurological",
  "immune",
  "environment",
  "model",
  "radiation",
  "actions",
  "other",
] as const;

export type Screen = (typeof SCREENS)[number];

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; reference: string } | { kind: "error"; key: MessageKey };

interface Props {
  open: boolean;
  onClose: () => void;
  screen: Screen;
  missionDay: number | null;
  mode: Mode;
  crewId: string;
}

export async function sendReport(body: Record<string, unknown>): Promise<string> {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 429) throw new Error("rate");
  if (!response.ok) throw new Error(`status ${response.status}`);
  const created = (await response.json()) as { reference: string };
  return created.reference;
}

export function ReportDialog({ open, onClose, screen, missionDay, mode, crewId }: Props) {
  const { t, language } = useI18n();
  const [what, setWhat] = useState("");
  const [expected, setExpected] = useState("");
  const [tester, setTester] = useState("");
  const [where, setWhere] = useState<Screen>(screen);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!what.trim()) {
      setStatus({ kind: "error", key: "report.required" });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const reference = await sendReport({
        what_happened: what,
        expected,
        screen: where,
        tester,
        mission_day: missionDay,
        mode,
        crew: crewId,
        language,
      });
      setStatus({ kind: "sent", reference });
      setWhat("");
      setExpected("");
    } catch (error) {
      console.error("Report not sent", error);
      setStatus({
        kind: "error",
        key: error instanceof Error && error.message === "rate" ? "report.rate" : "report.failed",
      });
    }
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="report-title">{t("report.title")}</h2>
        <form onSubmit={submit} className="form">
          <label>
            {t("report.what")}
            <textarea value={what} onChange={(e) => setWhat(e.target.value)} maxLength={2000} rows={4} required />
          </label>
          <label>
            {t("report.expected")}
            <textarea value={expected} onChange={(e) => setExpected(e.target.value)} maxLength={1000} rows={2} />
          </label>
          <label>
            {t("report.screen")}
            <select value={where} onChange={(e) => setWhere(e.target.value as Screen)}>
              {SCREENS.map((s) => (
                <option key={s} value={s}>
                  {t(`screen.${s}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("report.tester")}
            <input value={tester} onChange={(e) => setTester(e.target.value)} maxLength={40} />
          </label>
          <p className="note">{t("report.privacy")}</p>
          {status.kind === "sent" && <p className="status ok">{t("report.sent", { reference: status.reference })}</p>}
          {status.kind === "error" && <p className="status crit">{t(status.key)}</p>}
          <div className="form-actions">
            <button type="button" className="lang" onClick={onClose}>
              {t("actions.close")}
            </button>
            <button type="submit" className="primary" disabled={status.kind === "sending"}>
              {status.kind === "sending" ? t("report.sending") : t("report.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
