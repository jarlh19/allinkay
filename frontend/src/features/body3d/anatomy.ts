import { Group, Mesh, type BufferGeometry, type Object3D, type ShaderMaterial } from "three";

import type { SystemStatus } from "../../api/liveState";
import { HOLO_CYAN, STATUS_COLOR, hologramMaterial, setHoloColor, type HoloClock, type HoloLook } from "./hologram";

/**
 * The parts inside the glass body, from the anatomy model (BodyParts3D, CC BY 4.0, see NOTICE),
 * which also holds the skin: y up, facing +z, soles at y = 0 and 1 unit = the person's height.
 */
export type AnatomyPart = "skeleton" | "brain" | "heart" | "lungs";
const PARTS: AnatomyPart[] = ["skeleton", "brain", "heart", "lungs"];

/** How each part glows when its system is usual; brain and heart turn amber or red with an alert. */
const LOOK: Record<AnatomyPart, Omit<HoloLook, "height" | "base">> = {
  skeleton: { color: 0x9fe6ff, fill: 0.006, rim: 0.2, scan: 0, sweep: 0.06 },
  lungs: { color: HOLO_CYAN, fill: 0.004, rim: 0.16, scan: 0, sweep: 0.05 },
  brain: { color: 0xb5efff, fill: 0.025, rim: 0.42, scan: 0, sweep: 0.06 },
  heart: { color: 0xdff8ff, fill: 0.1, rim: 0.85, scan: 0, sweep: 0.06 },
};

/** About 66 beats a minute: a calm sign of life, not the measured heart rate. */
const HEART_BEAT_HZ = 1.1;

export class Anatomy {
  readonly group = new Group();
  private readonly meshes = new Map<AnatomyPart, Mesh>();
  private readonly materials = new Map<AnatomyPart, ShaderMaterial>();
  private head: SystemStatus = "ok";
  private chest: SystemStatus = "ok";

  constructor(model: Object3D, height: number, base: number, clock: HoloClock) {
    for (const part of PARTS) {
      const node = model.getObjectByName(part);
      if (!(node instanceof Mesh)) continue;
      const geometry = (node.geometry as BufferGeometry).clone();
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      const material = hologramMaterial({ ...LOOK[part], height, base }, clock);
      // Inner parts are drawn after the glass shell, so they read as lying inside it.
      const mesh = new Mesh(geometry, material);
      mesh.name = part;
      mesh.position.copy(node.position);
      mesh.quaternion.copy(node.quaternion);
      mesh.scale.copy(node.scale);
      mesh.renderOrder = part === "skeleton" || part === "lungs" ? 1 : 2;
      this.meshes.set(part, mesh);
      this.materials.set(part, material);
      this.group.add(mesh);
    }
    this.group.scale.setScalar(height);
  }

  setStatuses(head: SystemStatus, chest: SystemStatus): void {
    this.head = head;
    this.chest = chest;
    this.tint("brain", head);
    this.tint("heart", chest);
  }

  /** Hidden while the body wears the suit: the straight arms of the skeleton would show outside its bent sleeves. */
  showSkeleton(visible: boolean): void {
    const skeleton = this.meshes.get("skeleton");
    if (skeleton) skeleton.visible = visible;
  }

  update(seconds: number, moving: boolean, pulse: number): void {
    const beat = moving ? Math.pow(Math.max(0, Math.sin(seconds * Math.PI * 2 * HEART_BEAT_HZ)), 6) : 0;
    const heart = this.meshes.get("heart");
    heart?.scale.setScalar(1 + 0.08 * beat);
    this.opacity("heart", (this.chest === "ok" ? 0.9 : 0.8 + 0.5 * pulse) + 0.6 * beat);
    this.opacity("brain", this.head === "ok" ? 0.9 : 0.7 + 0.5 * pulse);
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
  }

  private tint(part: AnatomyPart, status: SystemStatus): void {
    const material = this.materials.get(part);
    if (!material) return;
    const color = status === "ok" ? LOOK[part].color : STATUS_COLOR[status];
    setHoloColor(material, "uColor", color);
    setHoloColor(material, "uRimColor", color);
  }

  private opacity(part: AnatomyPart, value: number): void {
    const uniform = this.materials.get(part)?.uniforms.uOpacity;
    if (uniform) uniform.value = value;
  }
}
