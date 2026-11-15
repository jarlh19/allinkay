import { useEffect, useRef, useState, type ReactNode } from "react";

import type { Anchors, BodyPick, BodyScene, BodyStatuses } from "./BodyScene";

/** The skin, skeleton and organs of the BodyParts3D atlas body (see NOTICE). */
const MODEL_URL = "/models/anatomy.glb";

/** WebGL is checked without touching a canvas when the browser has no WebGL at all. */
export function supportsWebGL(): boolean {
  if (typeof window === "undefined" || typeof window.WebGLRenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface Props {
  statuses: BodyStatuses;
  label: string;
  onPick: (pick: BodyPick) => void;
  /** Called after every frame with where each ring points to on the canvas. */
  onAnchors?: (anchors: Anchors, canvas: HTMLCanvasElement) => void;
  /** The colour behind the canvas (a hex number); the panel's own by default. */
  background?: number;
  /** The 2D figure, shown while the 3D body loads or when the device cannot show it. */
  children: ReactNode;
}

/** The 3D glass body. three.js is loaded on demand, so the panel opens just as fast as before. */
export function Body3D({ statuses, label, onPick, onAnchors, background, children }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<BodyScene | null>(null);
  const latest = useRef({ statuses, onPick, onAnchors });
  const [mode, setMode] = useState<"loading" | "3d" | "2d">(() => (supportsWebGL() ? "loading" : "2d"));
  const wants3d = useRef(mode === "loading");
  // The canvas colour is fixed when the scene is built.
  const backdrop = useRef(background);

  useEffect(() => {
    if (!wants3d.current || !container.current) return;
    let cancelled = false;
    const host = container.current;
    import("./BodyScene")
      .then(({ BodyScene: Scene }) =>
        Scene.create(
          host,
          MODEL_URL,
          (pick) => latest.current.onPick(pick),
          prefersReducedMotion(),
          (anchors, canvas) => latest.current.onAnchors?.(anchors, canvas),
          backdrop.current,
        ),
      )
      .then((created) => {
        if (cancelled) {
          created.dispose();
          return;
        }
        scene.current = created;
        created.setStatuses(latest.current.statuses);
        setMode("3d");
      })
      .catch((error: unknown) => {
        console.error("The 3D body could not load; showing the 2D figure instead", error);
        if (!cancelled) setMode("2d");
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
    // The scene is built once; statuses and callbacks reach it through `latest`.
  }, []);

  useEffect(() => {
    latest.current = { statuses, onPick, onAnchors };
  });

  useEffect(() => {
    scene.current?.setStatuses(statuses);
  }, [statuses]);

  return (
    <div className="body-3d" data-mode={mode}>
      {mode !== "2d" && <div ref={container} className="body-3d-stage" role="img" aria-label={label} />}
      {mode !== "3d" && <div className="body-3d-fallback">{children}</div>}
    </div>
  );
}
