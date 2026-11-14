import type { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  status?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** One expandable section of the detail column: a header button and, when open, its content. */
export function DetailSection({ id, title, status, open, onToggle, children }: Props) {
  const headerId = `panel-${id}-header`;
  const bodyId = `panel-${id}-body`;
  return (
    <section className={`detail-section${open ? " open" : ""}`} id={`panel-${id}`}>
      <h2>
        <button type="button" id={headerId} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <span>{title}</span>
          <span className="detail-head-right">
            {status}
            <span className="chevron" aria-hidden="true" />
          </span>
        </button>
      </h2>
      {open && (
        <div className="detail-body" id={bodyId} role="region" aria-labelledby={headerId}>
          {children}
        </div>
      )}
    </section>
  );
}
