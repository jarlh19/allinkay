/** A screen rectangle, as getBoundingClientRect gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Each leader leaves its ring flat for a few pixels before it turns towards the body. */
export const ELBOW = 14;

/**
 * The leader line from a ring to its spot on the body, in pixels of the stage that holds both.
 * It starts at the ring's inner edge (the side facing the body), runs flat for `ELBOW` pixels
 * and then goes straight to the spot, given in pixels of the canvas.
 */
export function leaderPath(
  ring: Box,
  side: "left" | "right",
  stage: Pick<Box, "left" | "top">,
  canvas: Pick<Box, "left" | "top">,
  spot: { x: number; y: number },
): { points: string; tip: { x: number; y: number } } {
  const fromX = (side === "left" ? ring.right : ring.left) - stage.left;
  const fromY = (ring.top + ring.bottom) / 2 - stage.top;
  const bendX = fromX + (side === "left" ? ELBOW : -ELBOW);
  const tip = { x: canvas.left - stage.left + spot.x, y: canvas.top - stage.top + spot.y };
  return { points: `${fromX},${fromY} ${bendX},${fromY} ${tip.x},${tip.y}`, tip };
}
