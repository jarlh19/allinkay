import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  ShaderMaterial,
  type BufferGeometry,
  type Texture,
  TorusGeometry,
} from "three";

/** Pedestal sizes as fractions of the body height. */
const LOWER = { radius: 0.31, height: 0.022 };
const UPPER = { radius: 0.245, height: 0.024 };
const BEAM_HEIGHT = 0.5;

const beamVertex = /* glsl */ `
uniform float uHeight;
varying float vRise;
varying vec3 vNormalView;
varying vec3 vToCamera;
void main() {
  vRise = clamp(position.y / uHeight + 0.5, 0.0, 1.0);
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vToCamera = -view.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * view;
}
`;

const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying float vRise;
varying vec3 vNormalView;
varying vec3 vToCamera;
void main() {
  // Brightest at the pedestal, fading upwards, and stronger where the wall is seen edge-on.
  float edge = 1.0 - abs(dot(normalize(vToCamera), normalize(vNormalView)));
  float fade = pow(1.0 - vRise, 3.2);
  gl_FragColor = vec4(uColor * fade * (0.25 + 0.75 * edge) * uStrength, 1.0);
}
`;

/**
 * The base the body stands on: a dark two-step disc with glowing edges, rings on top and a soft
 * column of light. All the light takes the colour of the ship environment's status.
 */
export class Pedestal {
  readonly group = new Group();
  /** World height of the surface the feet stand on. */
  readonly top: number;
  /** The solid part, for clicks. */
  readonly solid: Group = new Group();
  private readonly glow: MeshBasicMaterial[] = [];
  private readonly glowStrength: number[] = [];
  private readonly beam: ShaderMaterial;
  private readonly dashes = new Group();
  private readonly owned: { dispose(): void }[] = [];

  constructor(height: number, glowMap: Texture, color: number) {
    const metal = new MeshStandardMaterial({ color: 0x0c1620, metalness: 0.75, roughness: 0.32 });
    this.owned.push(metal);
    const lower = this.mesh(new CylinderGeometry(LOWER.radius * height, (LOWER.radius + 0.01) * height, LOWER.height * height, 96), metal);
    lower.position.y = (LOWER.height * height) / 2;
    const upper = this.mesh(new CylinderGeometry(UPPER.radius * height, (UPPER.radius + 0.006) * height, UPPER.height * height, 96), metal);
    upper.position.y = LOWER.height * height + (UPPER.height * height) / 2;
    this.solid.add(lower, upper);
    this.group.add(this.solid);
    this.top = (LOWER.height + UPPER.height) * height;

    // Glowing edges of both steps.
    this.flatRing(this.torus(LOWER.radius * height, 0.0022 * height), LOWER.height * height, 0.55, true);
    this.flatRing(this.torus(UPPER.radius * height, 0.0028 * height), this.top, 1, true);
    // Rings on the top surface: a soft glow, an outer band, a thin inner ring and a turning dashed ring.
    const lift = this.top + 0.0015 * height;
    const pool = this.flatRing(new RingGeometry(0, 0.24 * height, 64), lift - 0.0005 * height, 0.55);
    (pool.material as MeshBasicMaterial).map = glowMap;
    this.flatRing(new RingGeometry(0.2 * height, 0.226 * height, 96), lift, 0.5);
    this.flatRing(new RingGeometry(0.115 * height, 0.12 * height, 80), lift, 0.6);
    this.flatRing(new RingGeometry(0.06 * height, 0.063 * height, 64), lift, 0.45);
    const dashCount = 36;
    const dashGeometry = new RingGeometry(0.168 * height, 0.176 * height, 4, 1, 0, (Math.PI * 2) / dashCount / 2);
    this.owned.push(dashGeometry);
    const dashMaterial = this.glowMaterial(0.7);
    for (let i = 0; i < dashCount; i++) {
      const dash = new Mesh(dashGeometry, dashMaterial);
      dash.rotation.z = (i * Math.PI * 2) / dashCount;
      this.dashes.add(dash);
    }
    this.dashes.rotation.x = -Math.PI / 2;
    this.dashes.position.y = lift;
    this.group.add(this.dashes);

    // A column of light rising from the top, wider at the base.
    this.beam = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(color) }, uStrength: { value: 0.08 }, uHeight: { value: BEAM_HEIGHT * height } },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.owned.push(this.beam);
    const beam = this.mesh(new CylinderGeometry(0.2 * height, 0.226 * height, BEAM_HEIGHT * height, 64, 1, true), this.beam);
    beam.position.y = this.top + (BEAM_HEIGHT * height) / 2;
    beam.renderOrder = 3;
    this.group.add(beam);
    this.setColor(color);
  }

  setColor(color: number): void {
    for (const material of this.glow) material.color.set(color);
    (this.beam.uniforms.uColor?.value as Color).set(color);
  }

  update(seconds: number, moving: boolean, alert: number): void {
    this.dashes.rotation.z = moving ? seconds * 0.12 : 0;
    // The light breathes a little faster and brighter when the environment needs attention.
    const breath = moving ? 0.5 + 0.5 * Math.sin(seconds * (alert > 0 ? 3 : 1.2)) : 0.5;
    this.glow.forEach((material, i) => {
      material.opacity = (this.glowStrength[i] ?? 1) * (0.75 + 0.25 * breath + 0.35 * alert * breath);
    });
    if (this.beam.uniforms.uStrength) this.beam.uniforms.uStrength.value = 0.07 + 0.02 * breath + 0.08 * alert * breath;
  }

  dispose(): void {
    for (const item of this.owned) item.dispose();
  }

  private glowMaterial(strength: number): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.glow.push(material);
    this.glowStrength.push(strength);
    this.owned.push(material);
    return material;
  }

  private mesh(geometry: BufferGeometry, material: MeshStandardMaterial | ShaderMaterial | MeshBasicMaterial): Mesh {
    this.owned.push(geometry);
    const mesh = new Mesh(geometry, material);
    this.group.add(mesh);
    return mesh;
  }

  private torus(radius: number, tube: number): TorusGeometry {
    return new TorusGeometry(radius, tube, 8, 128);
  }

  /** A glowing piece lying flat at a height; tori are already round in their own plane. */
  private flatRing(geometry: BufferGeometry, y: number, strength: number, torus = false): Mesh {
    const ring = this.mesh(geometry, this.glowMaterial(strength));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    ring.renderOrder = torus ? 1 : 2;
    return ring;
  }
}
