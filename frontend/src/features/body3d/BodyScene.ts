import {
  BufferAttribute,
  type BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  type ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import type { SystemStatus } from "../../api/liveState";
import { Anatomy } from "./anatomy";
import { skinGeometry, zoneData } from "./bodyGeometry";
import { HOLO_CYAN, STATUS_COLOR, hologramMaterial, setHoloColor } from "./hologram";
import { Pedestal } from "./pedestal";
import { ZONES, type Zone } from "./zones";

export interface BodyStatuses {
  head: SystemStatus;
  chest: SystemStatus;
  abdomen: SystemStatus;
  radiation: SystemStatus;
  environment: SystemStatus;
}

export type BodyPick = Zone | "environment";

/** The systems a ring around the body stands for; each one points to a spot on the body. */
export type AnchorTarget = "neurological" | "cardiovascular" | "model" | "immune" | "radiation" | "environment";

/** Where each ring points to, in canvas pixels, refreshed on every frame as the body sways. */
export type Anchors = Partial<Record<AnchorTarget, { x: number; y: number }>>;

type BodyTarget = Exclude<AnchorTarget, "environment">;
type Spot = [number, number, number];

/**
 * Anchor spots on the body as fractions of its height: x to the viewer's right, y up from the soles,
 * z towards the viewer. The anatomy model brings its own, measured on its organs and bones; these
 * are the same values, in case a model comes without them.
 */
const BODY_SPOTS: Record<BodyTarget, Spot> = {
  neurological: [0.0001, 0.9455, -0.0122],
  cardiovascular: [0.0129, 0.7631, 0.0132],
  model: [-0.015, 0.7174, 0.0501],
  immune: [-0.015, 0.6126, 0.0426],
  radiation: [0.1166, 0.644, -0.0174],
};
const BODY_TARGETS = Object.keys(BODY_SPOTS) as BodyTarget[];
/** Height where the chest turns into the abdomen, if the model does not say. */
const CHEST_FROM = 0.7224;

/** What the anatomy model stores in its scene extras. */
interface ModelExtras {
  chestFrom?: number;
  anchors?: Partial<Record<BodyTarget, Spot>>;
}

/** The panel behind the canvas (`--panel`), so the bloom can work on an opaque picture. */
export const PANEL_BACKGROUND = 0x141c25;
/** Glow around bright parts: strength, spread and the brightness where it starts. */
const BLOOM = { strength: 0.55, radius: 0, threshold: 0.3, levels: [1, 0.75, 0.4, 0.1, 0] };

/** A white radial glow that fades to nothing at the edge, tinted by the material colour. */
function radialGlow(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,0.55)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

export class BodyScene {
  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 50);
  private readonly figure = new Group();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly clock = { time: { value: 0 }, pulse: { value: 0 } };
  private readonly shell: ShaderMaterial;
  private readonly body: Mesh;
  private readonly pedestal: Pedestal;
  private readonly glowMap = radialGlow();
  private readonly height: number;
  private readonly spots: Record<BodyTarget, Spot>;
  private readonly environmentSpot: [number, number, number];
  private readonly spot = new Vector3();
  private readonly onFrame?: (anchors: Anchors, canvas: HTMLCanvasElement) => void;
  private readonly weights: Float32Array;
  private readonly dominant: Zone[];
  private readonly anatomy: Anatomy;
  private statuses: BodyStatuses = { head: "ok", chest: "ok", abdomen: "ok", radiation: "ok", environment: "ok" };
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private visible = true;
  private frame = 0;
  private readonly started = performance.now();
  private readonly onClick: (event: MouseEvent) => void;
  private readonly onMove: (event: PointerEvent) => void;

  /** Loads the anatomy model (skin, skeleton and organs of the atlas body) and builds the scene. */
  static async create(
    container: HTMLElement,
    modelUrl: string,
    onPick: (pick: BodyPick) => void,
    reducedMotion: boolean,
    onFrame?: (anchors: Anchors, canvas: HTMLCanvasElement) => void,
    background: number = PANEL_BACKGROUND,
  ): Promise<BodyScene> {
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    return new BodyScene(container, gltf.scene, onPick, reducedMotion, onFrame, background);
  }

  private constructor(
    private readonly container: HTMLElement,
    model: Group,
    onPick: (pick: BodyPick) => void,
    private readonly reducedMotion: boolean,
    onFrame: ((anchors: Anchors, canvas: HTMLCanvasElement) => void) | undefined,
    background: number,
  ) {
    this.onFrame = onFrame;
    const skin = model.getObjectByName("skin");
    if (!(skin instanceof Mesh)) throw new Error("The anatomy model has no skin");
    const source = skin.geometry as BufferGeometry;
    const baked = source.getAttribute("color");
    if (!(baked instanceof BufferAttribute) || baked.itemSize !== 4) throw new Error("The skin has no body zones");
    const extras = model.userData as ModelExtras;
    this.spots = { ...BODY_SPOTS, ...extras.anchors };
    const geometry = skinGeometry(source);
    const { weights, dominant } = zoneData(geometry, baked, extras.chestFrom ?? CHEST_FROM);
    this.weights = weights;
    this.dominant = dominant;
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("alert", new BufferAttribute(new Float32Array(count), 1));
    const height = (geometry.boundingBox?.max.y ?? 1) - (geometry.boundingBox?.min.y ?? 0);
    this.height = height;

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Bright light should stay the hologram's own colour instead of fading to grey.
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.domElement.className = "body-3d-canvas";
    container.appendChild(this.renderer.domElement);
    // The colour right behind the canvas, so its edges do not show.
    this.scene.background = new Color(background);

    // The base the body stands on stands for the ship environment around the person.
    this.pedestal = new Pedestal(height, this.glowMap, STATUS_COLOR.ok);
    this.scene.add(this.pedestal.group);
    this.environmentSpot = [0.2 * height, this.pedestal.top, 0.14 * height];

    this.shell = hologramMaterial(
      { color: HOLO_CYAN, fill: 0.012, rim: 0.85, scan: 0.04, sweep: 0.12, height, base: this.pedestal.top, zones: true },
      this.clock,
    );
    this.body = new Mesh(geometry, this.shell);
    this.figure.add(this.body);
    this.anatomy = new Anatomy(model, height, this.pedestal.top, this.clock);
    this.figure.add(this.anatomy.group);
    this.figure.position.y = this.pedestal.top;
    this.scene.add(this.figure);

    this.scene.add(new HemisphereLight(0xcfe8ff, 0x05090d, 0.9));
    const key = new DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3, 4);
    this.scene.add(key);
    const back = new DirectionalLight(0x6fd4ff, 1.8);
    back.position.set(-3, 2, -4);
    this.scene.add(back);

    // A slightly high camera, so the rings on the pedestal read as rings.
    const center = (this.pedestal.top + height) / 2;
    const span = (height + this.pedestal.top) * 1.16;
    const distance = span / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(0, center + height * 0.28, distance);
    this.camera.lookAt(0, center - height * 0.02, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    // Keep the glow close to the light: the widest blur levels lit the whole canvas into a box.
    const levels = this.bloom.compositeMaterial.uniforms.bloomFactors;
    if (levels) levels.value = BLOOM.levels;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.onClick = (event) => {
      const pick = this.pick(event);
      if (pick) onPick(pick);
    };
    this.onMove = (event) => {
      this.renderer.domElement.style.cursor = this.pick(event) ? "pointer" : "default";
    };
    this.renderer.domElement.addEventListener("click", this.onClick);
    this.renderer.domElement.addEventListener("pointermove", this.onMove);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.visibilityObserver = new IntersectionObserver((entries) => {
      this.visible = entries.some((entry) => entry.isIntersecting);
    });
    this.visibilityObserver.observe(container);
    this.resize();
    this.applyStatuses();
    this.loop();
  }

  setStatuses(statuses: BodyStatuses): void {
    this.statuses = statuses;
    this.applyStatuses();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.renderer.domElement.removeEventListener("click", this.onClick);
    this.renderer.domElement.removeEventListener("pointermove", this.onMove);
    this.body.geometry.dispose();
    this.shell.dispose();
    this.pedestal.dispose();
    this.anatomy.dispose();
    this.glowMap.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private statusOf(zone: Zone): SystemStatus {
    if (zone === "head" || zone === "chest" || zone === "abdomen") return this.statuses[zone];
    return this.statuses.radiation;
  }

  /** Only the zones with an alert take a colour; the rest stays the hologram's own cyan. */
  private applyStatuses(): void {
    const tint = ZONES.map((zone) => new Color(STATUS_COLOR[this.statusOf(zone)]));
    const level = ZONES.map((zone) => {
      const status = this.statusOf(zone);
      return status === "ok" ? 0 : status === "warn" ? 0.75 : 1;
    });
    const colors = this.body.geometry.getAttribute("color") as BufferAttribute;
    const alerts = this.body.geometry.getAttribute("alert") as BufferAttribute;
    for (let v = 0; v < colors.count; v++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let alert = 0;
      ZONES.forEach((_, z) => {
        const w = this.weights[v * ZONES.length + z] ?? 0;
        const c = tint[z];
        if (w === 0 || !c) return;
        r += c.r * w;
        g += c.g * w;
        b += c.b * w;
        alert += (level[z] ?? 0) * w;
      });
      colors.setXYZ(v, r, g, b);
      alerts.setX(v, alert);
    }
    colors.needsUpdate = true;
    alerts.needsUpdate = true;
    // The outline is the skin: it shows radiation, cyan when usual, amber or red with an alert.
    setHoloColor(this.shell, "uRimColor", this.statuses.radiation === "ok" ? HOLO_CYAN : STATUS_COLOR[this.statuses.radiation]);
    this.pedestal.setColor(this.statuses.environment === "ok" ? HOLO_CYAN : STATUS_COLOR[this.statuses.environment]);
    this.anatomy.setStatuses(this.statuses.head, this.statuses.chest);
    this.render(this.elapsed());
  }

  /** Projects every anchor spot onto the canvas, after the frame is drawn. */
  private reportAnchors(): void {
    if (!this.onFrame) return;
    const canvas = this.renderer.domElement;
    const anchors: Anchors = {};
    const toCanvas = (target: AnchorTarget) => {
      this.spot.project(this.camera);
      anchors[target] = {
        x: ((this.spot.x + 1) / 2) * canvas.clientWidth,
        y: ((1 - this.spot.y) / 2) * canvas.clientHeight,
      };
    };
    for (const target of BODY_TARGETS) {
      const [x, y, z] = this.spots[target];
      // Spots on the body sway with it.
      this.spot.set(x * this.height, y * this.height, z * this.height).applyMatrix4(this.figure.matrixWorld);
      toCanvas(target);
    }
    this.spot.set(...this.environmentSpot);
    toCanvas("environment");
    this.onFrame(anchors, canvas);
  }

  private pick(event: MouseEvent): BodyPick | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const face = this.raycaster.intersectObject(this.body, false)[0]?.face;
    const zone = face ? this.dominant[face.a] : undefined;
    if (zone) return zone;
    return this.raycaster.intersectObject(this.pedestal.solid, true).length > 0 ? "environment" : null;
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render(this.elapsed());
  }

  private elapsed(): number {
    return (performance.now() - this.started) / 1000;
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
    this.render(this.elapsed());
  };

  private render(seconds: number): void {
    const moving = !this.reducedMotion;
    // A gentle sway keeps the body alive without turning its back on the viewer.
    this.figure.rotation.y = moving ? Math.sin(seconds * 0.35) * 0.35 : 0;
    const wave = moving ? 0.5 + 0.5 * Math.sin(seconds * 3) : 0.5;
    this.clock.pulse.value = wave;
    // Without motion the sweep rests at chest height instead of climbing.
    this.clock.time.value = moving ? seconds : 4.6;
    const rim = this.shell.uniforms.uRim;
    if (rim) rim.value = this.statuses.radiation === "ok" ? 0.85 : 1.05 + 0.8 * wave;
    this.pedestal.update(seconds, moving, this.statuses.environment === "ok" ? 0 : 1);
    this.anatomy.update(seconds, moving, wave);
    this.composer.render();
    this.reportAnchors();
  }
}
