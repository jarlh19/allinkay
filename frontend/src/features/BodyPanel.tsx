import { useCallback, useMemo, useRef, useState } from "react";

import type { SystemStatus } from "../api/liveState";
import type { Evaluation, Mode, Radiation, System } from "../api/types";
import { useI18n } from "../i18n/i18n";
import { Ring } from "./Ring";
import { systemKey } from "./signals";
import { StatusChip } from "./StatusChip";
import { SystemIcon } from "./SystemIcon";
import { Body3D } from "./body3d/Body3D";
import type { Anchors, BodyPick, BodyStatuses } from "./body3d/BodyScene";
import { ZONE_SYSTEM } from "./body3d/zones";
import { leaderPath } from "./leaders";
import { inNormal, targetShare, targetStatus, type Target } from "./statusSummary";

/** Bubbles on each side of the figure, top to bottom in the order of the zone they point to. */
const LEFT: Target[] = ["neurological", "model", "immune"];
const RIGHT: Target[] = ["cardiovascular", "radiation", "environment"];

const COLOR: Record<SystemStatus, string> = { ok: "#6fa3d8", warn: "#e3a33b", crit: "#ef5b5b" };
/** The page colour (`--bg`): there is no panel behind the body. */
const PAGE_BACKGROUND = 0x0e141b;

interface Props {
  evaluation: Evaluation | null;
  radiation: Radiation | null;
  focused: Target | null;
  onFocus: (target: Target) => void;
  onMode: (mode: Mode) => void;
  /** Latest heart rate, shown in the cardiovascular bubble. */
  heartRate?: number | null;
}

/**
 * The hologram with the six systems as bubbles around it, joined to their spot on the body by
 * leader lines, with the legend and the ship / field switch below.
 */
export function BodyPanel({ evaluation, radiation, focused, onFocus, onMode, heartRate = null }: Props) {
  const { t } = useI18n();
  const status = (system: System): SystemStatus => targetStatus(system, evaluation, radiation);
  const head = status("neurological");
  const chest = status("cardiovascular");
  const abdomen = status("immune");
  const skin = status("radiation");
  const environment = status("environment");
  const bodyStatuses = useMemo<BodyStatuses>(
    () => ({ head, chest, abdomen, radiation: skin, environment }),
    [head, chest, abdomen, skin, environment],
  );
  const onPick = useCallback(
    (pick: BodyPick) => onFocus(pick === "environment" ? "environment" : ZONE_SYSTEM[pick]),
    [onFocus],
  );

  // Leader lines join each bubble to its spot on the 3D body. They follow the body as it sways,
  // so they are moved straight in the DOM on every frame instead of through React state.
  const stage = useRef<HTMLDivElement>(null);
  const leaders = useRef<SVGSVGElement>(null);
  const [withLeaders, setWithLeaders] = useState(false);
  const leadersShown = useRef(false);
  const onAnchors = useCallback((anchors: Anchors, canvas: HTMLCanvasElement) => {
    const box = stage.current;
    const svg = leaders.current;
    if (!box || !svg) return;
    if (!leadersShown.current) {
      leadersShown.current = true;
      setWithLeaders(true);
    }
    // Hidden on narrow screens, where the bubbles sit below the body.
    if (svg.clientWidth === 0) return;
    const origin = box.getBoundingClientRect();
    const view = canvas.getBoundingClientRect();
    for (const leader of svg.querySelectorAll<SVGGElement>("g[data-target]")) {
      const target = leader.dataset.target as Target;
      const spot = anchors[target];
      const ring = box.querySelector<HTMLElement>(`.gauge[data-target="${target}"]`);
      if (!spot || !ring) continue;
      const side = ring.classList.contains("left") ? "left" : "right";
      const { points, tip } = leaderPath(ring.getBoundingClientRect(), side, origin, view, spot);
      leader.querySelector("polyline")?.setAttribute("points", points);
      for (const circle of leader.querySelectorAll("circle.tip")) {
        circle.setAttribute("cx", String(tip.x));
        circle.setAttribute("cy", String(tip.y));
      }
    }
  }, []);

  const bubble = (target: Target, side: "left" | "right") => {
    const share = targetShare(target, evaluation, radiation);
    const { n, total } = inNormal(evaluation, target);
    const summary =
      target === "radiation" && radiation
        ? t("summary.dose", { percent: Math.round(radiation.career_fraction * 100) })
        : total === 0
          ? t("summary.waiting")
          : t("summary.inNormal", { n, total });
    const name = t(target === "model" ? "gauge.model" : systemKey(target));
    const targetState = targetStatus(target, evaluation, radiation);
    const beats = target === "cardiovascular" && heartRate !== null ? Math.round(heartRate) : null;
    return (
      <li key={target}>
        <button
          type="button"
          className={`gauge bubble ${side}`}
          data-target={target}
          aria-current={focused === target ? "true" : undefined}
          onClick={() => onFocus(target)}
        >
          <span className="bubble-name">
            <SystemIcon target={target} />
            {name}
          </span>
          <Ring share={share} status={targetState} size={66}>
            {beats !== null ? (
              <>
                {beats}
                <small>{t("unit.bpm")}</small>
              </>
            ) : (
              `${Math.round(share * 100)}%`
            )}
          </Ring>
          <span className="sr-only">
            {beats !== null ? `${beats} ${t("unit.bpm")}. ` : ""}
            {summary}
          </span>
          <StatusChip status={targetState} />
        </button>
      </li>
    );
  };
  const mode = evaluation?.mode ?? "ship";
  const radFocus = focused === "radiation";

  return (
    <section className="body-panel mission-body" aria-labelledby="body-title">
      <h2 id="body-title" className="sr-only">
        {t("body.figureTitle")}
      </h2>
      <div className="body-stage" ref={stage} data-leaders={withLeaders ? "" : undefined}>
      <ul className="gauges left">{LEFT.map((target) => bubble(target, "left"))}</ul>
      <div className="figure">
        <Body3D
          statuses={bodyStatuses}
          label={t(mode === "field" ? "body.legendSuit" : "body.legend")}
          suit={mode === "field"}
          onPick={onPick}
          onAnchors={onAnchors}
          background={PAGE_BACKGROUND}
        >
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
        </Body3D>
      </div>
      <ul className="gauges right">{RIGHT.map((target) => bubble(target, "right"))}</ul>
      <svg className="leaders" ref={leaders} aria-hidden="true">
        {[...LEFT, ...RIGHT].map((target) => (
          <g
            key={target}
            data-target={target}
            className={`leader ${targetStatus(target, evaluation, radiation)}${focused === target ? " focused" : ""}`}
          >
            <polyline />
            <circle className="tip halo" r="7" />
            <circle className="tip" r="3" />
          </g>
        ))}
      </svg>
      </div>
      <p className="legend">
        <i />
        {t(mode === "field" ? "body.legendSuit" : "body.legend")}
      </p>
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
