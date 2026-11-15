import type { ReactNode } from "react";

import type { Target } from "./statusSummary";

/** One sector of the radiation trefoil, between two radii, from `start` to `end` degrees (0 = right, clockwise). */
function sector(start: number, end: number, inner: number, outer: number): string {
  const point = (angle: number, radius: number) => {
    const radians = (angle * Math.PI) / 180;
    return `${(10 + radius * Math.cos(radians)).toFixed(2)} ${(10 + radius * Math.sin(radians)).toFixed(2)}`;
  };
  return `M${point(start, inner)} L${point(start, outer)} A${outer} ${outer} 0 0 1 ${point(end, outer)} L${point(end, inner)} A${inner} ${inner} 0 0 0 ${point(start, inner)} Z`;
}

// Blades at the upper left, upper right and bottom, as on the warning sign.
const TREFOIL = [-150, -30, 90].map((middle) => sector(middle - 30, middle + 30, 2.6, 7.2)).join(" ");

/** Line icons for the rings, drawn on a 20 × 20 grid in the hologram colour. */
const ICON: Record<Target, ReactNode> = {
  neurological: (
    <>
      <path d="M9.5 4.2a2.5 2.5 0 0 0-4.4 1.4 2.6 2.6 0 0 0-1.6 4.2 2.6 2.6 0 0 0 1.4 4.1 2.5 2.5 0 0 0 4.6 1.1z" />
      <path d="M10.5 4.2a2.5 2.5 0 0 1 4.4 1.4 2.6 2.6 0 0 1 1.6 4.2 2.6 2.6 0 0 1-1.4 4.1 2.5 2.5 0 0 1-4.6 1.1z" />
      <path d="M6.6 8.4c1 .3 1.6 1 1.6 2M13.4 8.4c-1 .3-1.6 1-1.6 2" />
    </>
  ),
  model: (
    <>
      <path d="M2.5 6.5h15M2.5 13.5h15" strokeDasharray="1.6 2" />
      <path d="M2.5 10.5l3-2.2 3 3 3-4 2.6 2.4 3.4-1.4" />
    </>
  ),
  immune: (
    <>
      <path d="M10 2.8 4.2 5v4.4c0 3.8 2.5 6.3 5.8 7.6 3.3-1.3 5.8-3.8 5.8-7.6V5z" />
      <path d="M7.4 9.9l1.9 1.9 3.4-3.6" />
    </>
  ),
  cardiovascular: (
    <>
      <path d="M10 16.6s-6.6-3.8-6.6-8.7a3.4 3.4 0 0 1 6.6-1.4 3.4 3.4 0 0 1 6.6 1.4c0 4.9-6.6 8.7-6.6 8.7z" />
      <path d="M4.6 10.4h2.8l1.3-2.2 1.9 4.1 1.3-1.9h3.5" />
    </>
  ),
  radiation: (
    <>
      <circle cx="10" cy="10" r="1.3" />
      <path d={TREFOIL} />
    </>
  ),
  environment: (
    <>
      <path d="M3 7.6h8.6a2.2 2.2 0 1 0-2.2-2.2" />
      <path d="M3 11h11.4a2.2 2.2 0 1 1-2.2 2.2" />
      <path d="M3 14.4h5" />
    </>
  ),
};

/** The icon of a ring; decorative, since the ring's name is written next to it. */
export function SystemIcon({ target }: { target: Target }) {
  return (
    <svg className="system-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {ICON[target]}
    </svg>
  );
}
