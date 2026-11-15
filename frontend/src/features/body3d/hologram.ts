import { AdditiveBlending, Color, FrontSide, ShaderMaterial, type Side } from "three";

import type { SystemStatus } from "../../api/liveState";

/** The hologram's own colour: every part of the body is drawn in it unless a status says otherwise. */
export const HOLO_CYAN = 0x45d4ff;
/** Status colours, the same as the rest of the panel (`--accent`, `--warn`, `--crit`). */
export const STATUS_COLOR: Record<SystemStatus, number> = { ok: 0x6fa3d8, warn: 0xe3a33b, crit: 0xef5b5b };

/** Values every hologram material reads on each frame. */
export interface HoloClock {
  time: { value: number };
  /** 0 to 1, the shared alert pulse. */
  pulse: { value: number };
}

export interface HoloLook {
  color: number;
  /** Glow of the faces looking at the viewer (0 is clear glass). */
  fill: number;
  /** Glow of the outline, where the surface turns away from the viewer. */
  rim: number;
  /** Fine horizontal scan lines. */
  scan: number;
  /** The bright band that sweeps up the body. */
  sweep: number;
  /** Height of the body, so the lines and the sweep keep their spacing at any size. */
  height: number;
  /** World height of the soles, where the sweep starts. */
  base: number;
  side?: Side;
  /** Per-vertex `alert` (0 to 1) and `color` tint for the zones of the body. */
  zones?: boolean;
}

const vertexShader = /* glsl */ `
uniform float uHeight;
uniform float uBase;
varying vec3 vNormalView;
varying vec3 vToCamera;
varying float vLevel;
varying float vAlert;
varying vec3 vTint;
#ifdef USE_ZONES
attribute float alert;
#endif
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 view = viewMatrix * world;
  vToCamera = -view.xyz;
  vNormalView = normalize(normalMatrix * normal);
  vLevel = (world.y - uBase) / uHeight;
#ifdef USE_ZONES
  vAlert = alert;
  vTint = color;
#else
  vAlert = 0.0;
  vTint = vec3(0.0);
#endif
  gl_Position = projectionMatrix * view;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRimColor;
uniform float uFill;
uniform float uRim;
uniform float uScan;
uniform float uSweep;
uniform float uTime;
uniform float uPulse;
uniform float uOpacity;
varying vec3 vNormalView;
varying vec3 vToCamera;
varying float vLevel;
varying float vAlert;
varying vec3 vTint;
void main() {
  vec3 normal = normalize(vNormalView);
  if (!gl_FrontFacing) normal = -normal;
  float facing = clamp(abs(dot(normalize(vToCamera), normal)), 0.0, 1.0);
  float outline = pow(1.0 - facing, 2.2);
  // Thin lines every 0.6 % of the body height, like a scan.
  float lines = smoothstep(0.82, 1.0, abs(sin(vLevel * 520.0)));
  // A soft band climbs from the feet to above the head every eight seconds.
  float sweepAt = fract(uTime * 0.125) * 1.4 - 0.2;
  float sweep = exp(-pow((vLevel - sweepAt) * 14.0, 2.0));
  float alert = clamp(vAlert, 0.0, 1.0);
  vec3 body = mix(uColor, vTint, alert);
  // An alerting zone takes the alert colour on its faces and on its outline, so it never mixes
  // with the cyan into white.
  float glow = uFill * (1.0 - alert) + lines * uScan + sweep * uSweep + alert * (0.07 + 0.2 * uPulse);
  vec3 light = body * glow + mix(uRimColor, body, alert) * outline * uRim * (1.0 + 0.6 * alert);
  gl_FragColor = vec4(light * uOpacity, 1.0);
}
`;

/** A see-through, glowing surface: bright outline, faint faces, scan lines and a rising sweep. */
export function hologramMaterial(look: HoloLook, clock: HoloClock): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(look.color) },
      uRimColor: { value: new Color(look.color) },
      uFill: { value: look.fill },
      uRim: { value: look.rim },
      uScan: { value: look.scan },
      uSweep: { value: look.sweep },
      uHeight: { value: look.height },
      uBase: { value: look.base },
      uOpacity: { value: 1 },
      uTime: clock.time,
      uPulse: clock.pulse,
    },
    defines: look.zones ? { USE_ZONES: "" } : {},
    vertexColors: look.zones ?? false,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: look.side ?? FrontSide,
  });
}

/** Sets a uniform colour of a hologram material. */
export function setHoloColor(material: ShaderMaterial, uniform: "uColor" | "uRimColor", color: number): void {
  (material.uniforms[uniform]?.value as Color | undefined)?.set(color);
}
