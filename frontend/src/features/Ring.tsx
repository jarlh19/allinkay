import type { ReactNode } from "react";

import type { SystemStatus } from "../api/liveState";

interface Props {
  share: number;
  status: SystemStatus;
  size?: number;
  children?: ReactNode;
}

/** A ring filled to `share` in the status color, with an optional label in its center.
 * Decorative: the same figure is always written next to it, so screen readers skip it. */
export function Ring({ share, status, size = 36, children }: Props) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(share, 1)) * length;
  return (
    <span className="ring" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 36 36">
        <circle className="ring-track" cx="18" cy="18" r={radius} />
        {filled > 0 && (
          <circle
            className={`ring-arc ${status}`}
            cx="18"
            cy="18"
            r={radius}
            strokeDasharray={`${filled} ${length}`}
            transform="rotate(-90 18 18)"
          />
        )}
      </svg>
      {children !== undefined && <span className="ring-label">{children}</span>}
    </span>
  );
}
