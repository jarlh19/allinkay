import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  NeutralToneMapping,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

import type { SystemStatus } from "../../api/liveState";
import { loopSubdivide, type TriangleMesh } from "./subdivide";
import { ZONES, zoneWeights, type Zone } from "./zones";

export interface BodyStatuses {
  head: SystemStatus;
  chest: SystemStatus;
  abdomen: SystemStatus;
  radiation: SystemStatus;
  environment: SystemStatus;
}

export type BodyPick = Zone | "environment";

/** Glass tints per zone, close to the team's reference: lavender head, blue chest, teal abdomen. */
const ZONE_COLOR: Record<Zone, number> = {
  head: 0xa9a3f2,
  chest: 0x6fa3e8,
  abdomen: 0x5cc9b6,
  arms: 0x9488e0,
  legs: 0x8f84dc,
};
const STATUS_COLOR: Record<SystemStatus, number> = { ok: 0x6fa3d8, warn: 0xe3a33b, crit: 0xef5b5b };
const RADIATION_GLOW = 0xb392f0;
/** Two Loop passes turn the 1.8k-triangle base mesh into a smooth 29k-triangle body. */
const SUBDIVISIONS = 2;

/** Light at the silhouette, shared by every zone: the skin glow that shows radiation. */
interface Rim {
  color: { value: Color };
  strength: { value: number };
}

/** Turns the raw mesh into a smooth, upright body facing the camera, feet at y = 0. */
function prepareGeometry(source: BufferGeometry, world: Matrix4): BufferGeometry {
  let geometry = new BufferGeometry();
  geometry.setAttribute("position", source.getAttribute("position").clone());
  if (source.index) geometry.setIndex(source.index.clone());
  geometry.applyMatrix4(world);

  geometry.computeBoundingBox();
  const size = new Vector3();
  geometry.boundingBox?.getSize(size);
  // The width (arms apart) goes along x, so the body faces the camera on +z.
  if (size.z > size.x) geometry.rotateY(-Math.PI / 2);

  // The feet point forward: make sure that is towards the camera.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new Box3();
  const positions = geometry.getAttribute("position");
  const footLevel = box.min.y + (box.max.y - box.min.y) * 0.04;
  let footZ = 0;
  let feet = 0;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) <= footLevel) {
      footZ += positions.getZ(i);
      feet++;
    }
  }
  const centerZ = (box.min.z + box.max.z) / 2;
  if (feet > 0 && footZ / feet < centerZ) geometry.rotateY(Math.PI);

  // UV seams split vertices; welding them lets subdivision and normals run across the surface.
  geometry = mergeVertices(geometry, 1e-4);
  const index = geometry.getIndex();
  if (!index) throw new Error("The body model has no indexed geometry");
  let mesh: TriangleMesh = {
    positions: Float32Array.from(geometry.getAttribute("position").array),
    indices: Uint32Array.from(index.array),
  };
  for (let pass = 0; pass < SUBDIVISIONS; pass++) mesh = loopSubdivide(mesh);
  const smooth = new BufferGeometry();
  smooth.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  smooth.setIndex(new BufferAttribute(mesh.indices, 1));

  smooth.computeBoundingBox();
  const fitted = smooth.boundingBox ?? new Box3();
  const center = new Vector3();
  fitted.getCenter(center);
  smooth.translate(-center.x, -fitted.min.y, -center.z);
  smooth.computeVertexNormals();
  smooth.computeBoundingBox();
  return smooth;
}

/** Each vertex's share of every zone (ZONES order) and the zone it mostly belongs to. */
function zoneData(geometry: BufferGeometry): { weights: Float32Array; dominant: Zone[] } {
  const positions = geometry.getAttribute("position");
  const box = geometry.boundingBox ?? new Box3();
  const height = box.max.y - box.min.y;
  const weights = new Float32Array(positions.count * ZONES.length);
  const dominant: Zone[] = [];
  for (let v = 0; v < positions.count; v++) {
    const shares = zoneWeights((positions.getY(v) - box.min.y) / height, Math.abs(positions.getX(v)) / height);
    weights.set(shares, v * ZONES.length);
    let best = 0;
    shares.forEach((share, i) => {
      if (share > (shares[best] ?? 0)) best = i;
    });
    dominant.push(ZONES[best] ?? "legs");
  }
  return { weights, dominant };
}

/**
 * One glass material for the whole body. Zone tints come per vertex, so borders fade smoothly;
 * an `alert` value per vertex makes alerting zones glow with a shared pulse; and a Fresnel rim
 * lights the silhouette (the skin) in the radiation colour.
 */
function glassBody(rim: Rim, pulse: { value: number }): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    emissive: 0x000000,
    roughness: 0.18,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.9,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = rim.color;
    shader.uniforms.rimStrength = rim.strength;
    shader.uniforms.pulse = pulse;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float alert;\nvarying float vAlert;")
      .replace("#include <color_vertex>", "#include <color_vertex>\nvAlert = alert;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float pulse;\nvarying float vAlert;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (0.28 + vAlert * pulse * 1.5);",
      )
      .replace(
        "#include <opaque_fragment>",
        [
          "float facing = clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0);",
          "float rim = pow(1.0 - facing, 2.4);",
          "outgoingLight += rimColor * rim * rimStrength;",
          "diffuseColor.a = max(mix(diffuseColor.a * 0.62, 1.0, rim), vAlert * 0.9);",
          "#include <opaque_fragment>",
        ].join("\n"),
      );
  };
  return material;
}

export class BodyScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(26, 1, 0.1, 50);
  private readonly figure = new Group();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly rim: Rim = { color: { value: new Color(RADIATION_GLOW) }, strength: { value: 1.4 } };
  private readonly pulse = { value: 0 };
  private readonly material: MeshPhysicalMaterial;
  private readonly platform: MeshBasicMaterial;
  private readonly platformMesh: Mesh;
  /** The whole floor inside the ring: a thin ring seen almost edge-on is too hard to click. */
  private readonly floor: Mesh;
  private readonly body: Mesh;
  private readonly weights: Float32Array;
  private readonly dominant: Zone[];
  private statuses: BodyStatuses = { head: "ok", chest: "ok", abdomen: "ok", radiation: "ok", environment: "ok" };
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private visible = true;
  private frame = 0;
  private readonly started = performance.now();
  private readonly onClick: (event: MouseEvent) => void;
  private readonly onMove: (event: PointerEvent) => void;

  static async create(
    container: HTMLElement,
    modelUrl: string,
    onPick: (pick: BodyPick) => void,
    reducedMotion: boolean,
  ): Promise<BodyScene> {
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    gltf.scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    gltf.scene.traverse((node) => {
      if (node instanceof Mesh) meshes.push(node);
    });
    const mesh = meshes[0];
    if (!mesh) throw new Error("The body model has no mesh");
    const geometry = prepareGeometry(mesh.geometry as BufferGeometry, mesh.matrixWorld);
    return new BodyScene(container, geometry, onPick, reducedMotion);
  }

  private constructor(
    private readonly container: HTMLElement,
    geometry: BufferGeometry,
    onPick: (pick: BodyPick) => void,
    private readonly reducedMotion: boolean,
  ) {
    const { weights, dominant } = zoneData(geometry);
    this.weights = weights;
    this.dominant = dominant;
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("alert", new BufferAttribute(new Float32Array(count), 1));
    const height = (geometry.boundingBox?.max.y ?? 1) - (geometry.boundingBox?.min.y ?? 0);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.domElement.className = "body-3d-canvas";
    container.appendChild(this.renderer.domElement);

    this.material = glassBody(this.rim, this.pulse);
    this.body = new Mesh(geometry, this.material);
    this.figure.add(this.body);

    // The ring at the feet stands for the ship environment around the person.
    this.platform = new MeshBasicMaterial({
      color: STATUS_COLOR.ok,
      side: DoubleSide,
      transparent: true,
      opacity: 0.45,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.platformMesh = new Mesh(new RingGeometry(height * 0.2, height * 0.235, 96), this.platform);
    this.platformMesh.rotation.x = -Math.PI / 2;
    this.platformMesh.position.y = 0.002;
    this.scene.add(this.platformMesh);
    this.floor = new Mesh(
      new CircleGeometry(height * 0.26, 48),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.scene.add(this.floor);
    this.scene.add(this.figure);

    this.scene.add(new HemisphereLight(0xd2e4ff, 0x0b1117, 1.1));
    const key = new DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    this.scene.add(key);
    const rimLight = new DirectionalLight(0x7fb2ff, 2.4);
    rimLight.position.set(-3, 2.5, -4);
    this.scene.add(rimLight);
    const fill = new DirectionalLight(0xb9a8ff, 0.7);
    fill.position.set(3, 1, -2);
    this.scene.add(fill);

    const distance = (height * 1.18) / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(0, height * 0.52, distance);
    this.camera.lookAt(0, height * 0.5, 0);

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
    this.platformMesh.geometry.dispose();
    this.floor.geometry.dispose();
    (this.floor.material as MeshBasicMaterial).dispose();
    this.material.dispose();
    this.platform.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private statusOf(zone: Zone): SystemStatus {
    if (zone === "head" || zone === "chest" || zone === "abdomen") return this.statuses[zone];
    return this.statuses.radiation;
  }

  /** Per-vertex tints and alert levels from the statuses; the pulse itself runs in the loop. */
  private applyStatuses(): void {
    const tint = ZONES.map((zone) => {
      const status = this.statusOf(zone);
      const base = new Color(ZONE_COLOR[zone]);
      return status === "ok" ? base : new Color(STATUS_COLOR[status]);
    });
    const level = ZONES.map((zone) => {
      const status = this.statusOf(zone);
      return status === "ok" ? 0 : status === "warn" ? 0.7 : 1;
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
    // The skin's glow shows radiation: violet when usual, amber or red with an alert.
    this.rim.color.value.set(this.statuses.radiation === "ok" ? RADIATION_GLOW : STATUS_COLOR[this.statuses.radiation]);
    this.platform.color.set(STATUS_COLOR[this.statuses.environment]);
    this.render(this.elapsed());
  }

  private pick(event: MouseEvent): BodyPick | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const face = this.raycaster.intersectObject(this.body, false)[0]?.face;
    const zone = face ? this.dominant[face.a] : undefined;
    if (zone) return zone;
    return this.raycaster.intersectObject(this.floor, false).length > 0 ? "environment" : null;
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
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
    this.pulse.value = 0.35 + 0.65 * wave;
    this.rim.strength.value = this.statuses.radiation === "ok" ? 1.4 : 1.8 + 1.6 * wave;
    this.renderer.render(this.scene, this.camera);
  }
}
