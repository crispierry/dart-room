"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { BOARD, SEGMENTS, scoreImpact, type HitResult } from "./lib/darts";
import styles from "./game.module.css";

export type DartboardSceneHandle = Readonly<{
  throwAt: (x: number, y: number, color?: string) => boolean;
  clearDarts: () => void;
}>;

type Props = Readonly<{
  disabled: boolean;
  playerColor: string;
  onHit: (hit: HitResult) => void;
}>;

type Gesture = Readonly<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}>;

type AnimatedDart = {
  group: THREE.Group;
  start: THREE.Vector3;
  end: THREE.Vector3;
  startedAt: number;
  duration: number;
  hit: HitResult;
  reported: boolean;
};

const SEGMENT_RADIANS = (Math.PI * 2) / SEGMENTS.length;

function ringSegmentGeometry(inner: number, outer: number, start: number, end: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
  shape.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
  shape.absarc(0, 0, outer, start, end, false);
  shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
  shape.absarc(0, 0, inner, end, start, true);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 10);
}

function addSegmentRing(
  group: THREE.Group,
  inner: number,
  outer: number,
  colors: readonly [string, string],
  z: number,
) {
  SEGMENTS.forEach((_, index) => {
    const center = Math.PI / 2 - index * SEGMENT_RADIANS;
    const geometry = ringSegmentGeometry(
      inner,
      outer,
      center - SEGMENT_RADIANS / 2,
      center + SEGMENT_RADIANS / 2,
    );
    const material = new THREE.MeshStandardMaterial({
      color: colors[index % 2],
      roughness: 0.82,
      metalness: 0.02,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    group.add(mesh);
  });
}

function textSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, 128, 128);
    context.fillStyle = "#ece7da";
    context.font = "700 48px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 64, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.38, 0.38, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function createBoard(): THREE.Group {
  const group = new THREE.Group();
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: "#111719", roughness: 0.72, metalness: 0.22 });
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.52, 0.32, 96), edgeMaterial);
  edge.rotation.x = Math.PI / 2;
  edge.position.z = -0.12;
  group.add(edge);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(2.42, 96),
    new THREE.MeshStandardMaterial({ color: "#111516", roughness: 0.9 }),
  );
  face.position.z = 0.052;
  group.add(face);

  addSegmentRing(group, BOARD.outerBull, BOARD.tripleInner, ["#efe9d9", "#161a1b"], 0.064);
  addSegmentRing(group, BOARD.tripleInner, BOARD.tripleOuter, ["#e4524d", "#39aa7a"], 0.068);
  addSegmentRing(group, BOARD.tripleOuter, BOARD.doubleInner, ["#efe9d9", "#161a1b"], 0.064);
  addSegmentRing(group, BOARD.doubleInner, BOARD.doubleOuter, ["#e4524d", "#39aa7a"], 0.068);

  const outerBull = new THREE.Mesh(
    new THREE.CircleGeometry(BOARD.outerBull, 48),
    new THREE.MeshStandardMaterial({ color: "#39aa7a", roughness: 0.78 }),
  );
  outerBull.position.z = 0.074;
  group.add(outerBull);

  const bull = new THREE.Mesh(
    new THREE.CircleGeometry(BOARD.bull, 40),
    new THREE.MeshStandardMaterial({ color: "#e4524d", roughness: 0.76 }),
  );
  bull.position.z = 0.082;
  group.add(bull);

  const wireMaterial = new THREE.MeshBasicMaterial({ color: "#c6c4b8", transparent: true, opacity: 0.52 });
  [BOARD.outerBull, BOARD.tripleInner, BOARD.tripleOuter, BOARD.doubleInner, BOARD.doubleOuter].forEach((radius) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.008, radius + 0.008, 96), wireMaterial);
    ring.position.z = 0.09;
    group.add(ring);
  });

  SEGMENTS.forEach((segment, index) => {
    const angle = Math.PI / 2 - index * SEGMENT_RADIANS;
    const sprite = textSprite(String(segment));
    sprite.position.set(Math.cos(angle) * 2.34, Math.sin(angle) * 2.34, 0.13);
    group.add(sprite);
  });

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(2.54, 2.6, 96),
    new THREE.MeshBasicMaterial({ color: "#72e5cf", transparent: true, opacity: 0.22 }),
  );
  halo.position.z = 0.02;
  group.add(halo);
  return group;
}

function createDart(color: string): THREE.Group {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: "#d9dfdc", metalness: 0.78, roughness: 0.25 });
  const accent = new THREE.MeshStandardMaterial({ color, metalness: 0.18, roughness: 0.46 });

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.72, 12), metal);
  barrel.rotation.x = Math.PI / 2;
  group.add(barrel);

  const point = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.35, 10), metal);
  point.rotation.x = -Math.PI / 2;
  point.position.z = -0.52;
  group.add(point);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48, 10), accent);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.56;
  group.add(shaft);

  const flightGeometry = new THREE.BoxGeometry(0.38, 0.018, 0.34);
  const flightA = new THREE.Mesh(flightGeometry, accent);
  flightA.position.z = 0.96;
  group.add(flightA);
  const flightB = new THREE.Mesh(flightGeometry, accent);
  flightB.rotation.z = Math.PI / 2;
  flightB.position.z = 0.96;
  group.add(flightB);

  group.scale.setScalar(0.82);
  return group;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Sprite)) return;
    if ("geometry" in child && child.geometry) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if ("map" in material && material.map instanceof THREE.Texture) material.map.dispose();
      material.dispose();
    });
  });
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

export const DartboardScene = forwardRef<DartboardSceneHandle, Props>(function DartboardScene(
  { disabled, playerColor, onHit },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const throwAtRef = useRef<(x: number, y: number, color?: string) => boolean>(() => false);
  const clearRef = useRef<() => void>(() => undefined);
  const disabledRef = useRef(disabled);
  const colorRef = useRef(playerColor);
  const onHitRef = useRef(onHit);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [hint, setHint] = useState("Drag upward and release over your target");

  disabledRef.current = disabled;
  colorRef.current = playerColor;
  onHitRef.current = onHit;

  useImperativeHandle(ref, () => ({
    throwAt: (x, y, color) => throwAtRef.current(x, y, color),
    clearDarts: () => clearRef.current(),
  }), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const container = mount;

    const scene = new THREE.Scene();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scene.fog = new THREE.FogExp2("#ffffff", 0.018);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.set(0, -0.05, 8.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = styles.webglCanvas;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#b9fff2", "#151113", 1.9));
    const key = new THREE.DirectionalLight("#fff2d3", 3.6);
    key.position.set(-3, 4, 7);
    scene.add(key);
    const rim = new THREE.PointLight("#68e4cf", 18, 14, 2);
    rim.position.set(3.5, -1, 5);
    scene.add(rim);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 18),
      new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
    );
    wall.position.z = -0.52;
    scene.add(wall);

    const board = createBoard();
    board.rotation.z = -0.006;
    scene.add(board);

    const oche = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 5),
      new THREE.MeshStandardMaterial({ color: "#eef0ef", roughness: 0.92, metalness: 0.02 }),
    );
    oche.rotation.x = -Math.PI / 2;
    oche.position.set(0, -3.25, 3.8);
    scene.add(oche);

    const reticle = new THREE.Group();
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: "#f3c85f", transparent: true, opacity: 0.95 });
    const reticleRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.118, 36), reticleMaterial);
    reticle.add(reticleRing);
    const reticleLineH = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.012), reticleMaterial);
    reticle.add(reticleLineH);
    const reticleLineV = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.34), reticleMaterial);
    reticle.add(reticleLineV);
    reticle.position.z = 0.19;
    reticle.visible = false;
    scene.add(reticle);

    const raycaster = new THREE.Raycaster();
    const boardPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const activeDarts: AnimatedDart[] = [];
    const landedDarts: THREE.Group[] = [];
    let frame = 0;
    let pointer: { id: number; x: number; y: number; startedAt: number } | null = null;

    function resize() {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = Math.max(8.8, 8.2 / Math.max(0.7, camera.aspect));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    function planePoint(clientX: number, clientY: number): THREE.Vector3 | null {
      const bounds = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - bounds.left) / bounds.width) * 2 - 1,
        -((clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(boardPlane, new THREE.Vector3());
    }

    function clearDarts() {
      for (const dart of [...activeDarts]) {
        scene.remove(dart.group);
        disposeObject(dart.group);
      }
      activeDarts.length = 0;
      for (const dart of [...landedDarts]) {
        scene.remove(dart);
        disposeObject(dart);
      }
      landedDarts.length = 0;
    }

    function throwAt(x: number, y: number, color = colorRef.current): boolean {
      if (activeDarts.length > 0) return false;
      const hit = scoreImpact(x, y);
      const dart = createDart(color);
      const start = new THREE.Vector3(
        THREE.MathUtils.clamp(x * 0.13, -0.5, 0.5),
        -2.85,
        7.25,
      );
      const end = new THREE.Vector3(x, y, 0.54);
      dart.position.copy(start);
      dart.rotation.set(-0.04, 0.08, Math.atan2(y + 2.85, x) * 0.015);
      scene.add(dart);
      activeDarts.push({
        group: dart,
        start,
        end,
        startedAt: performance.now(),
        duration: prefersReducedMotion ? 120 : 610,
        hit,
        reported: false,
      });
      reticle.visible = false;
      return true;
    }

    throwAtRef.current = throwAt;
    clearRef.current = clearDarts;

    function updateReticle(event: PointerEvent) {
      if (disabledRef.current || pointer) return;
      const point = planePoint(event.clientX, event.clientY);
      if (!point) return;
      reticle.position.x = point.x;
      reticle.position.y = point.y;
      reticle.visible = Math.hypot(point.x, point.y) <= BOARD.doubleOuter + 0.25;
    }

    function handlePointerDown(event: PointerEvent) {
      if (disabledRef.current || activeDarts.length > 0) return;
      renderer.domElement.setPointerCapture(event.pointerId);
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startedAt: performance.now() };
      setGesture({ startX: event.clientX, startY: event.clientY, endX: event.clientX, endY: event.clientY });
      setHint("Swipe toward the board");
    }

    function handlePointerMove(event: PointerEvent) {
      updateReticle(event);
      if (!pointer || event.pointerId !== pointer.id) return;
      setGesture({ startX: pointer.x, startY: pointer.y, endX: event.clientX, endY: event.clientY });
      const point = planePoint(event.clientX, event.clientY);
      if (point) {
        reticle.position.x = point.x;
        reticle.position.y = point.y;
        reticle.visible = true;
      }
    }

    function finishPointer(event: PointerEvent) {
      if (!pointer || event.pointerId !== pointer.id) return;
      const currentPointer = pointer;
      pointer = null;
      setGesture(null);
      const vertical = currentPointer.y - event.clientY;
      const horizontal = event.clientX - currentPointer.x;
      const duration = Math.max(80, performance.now() - currentPointer.startedAt);
      const distance = Math.hypot(horizontal, vertical);
      const point = planePoint(event.clientX, event.clientY);

      if (!point || vertical < 42 || distance < 58) {
        setHint("Use a longer upward swipe");
        reticle.visible = false;
        return;
      }

      const speed = distance / duration;
      const straightness = Math.max(0, 1 - Math.abs(horizontal) / Math.max(90, distance));
      const lengthQuality = Math.max(0, 1 - Math.abs(distance - 210) / 300);
      const speedQuality = Math.max(0, 1 - Math.abs(speed - 0.82) / 1.25);
      const quality = THREE.MathUtils.clamp(straightness * 0.45 + lengthQuality * 0.3 + speedQuality * 0.25, 0.15, 1);
      const spread = 0.025 + (1 - quality) * 0.34;
      const powerBias = THREE.MathUtils.clamp((distance - 210) / 620, -0.22, 0.22);
      const impactX = point.x + (Math.random() - 0.5) * spread * 2;
      const impactY = point.y + powerBias + (Math.random() - 0.5) * spread * 2;
      setHint(quality > 0.78 ? "Clean release" : quality > 0.5 ? "Good throw" : "Wobbly release");
      throwAt(impactX, impactY);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", finishPointer);
    renderer.domElement.addEventListener("pointercancel", finishPointer);
    renderer.domElement.addEventListener("pointerleave", (event) => {
      if (!pointer || event.pointerId !== pointer.id) reticle.visible = false;
    });

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    function render(now: number) {
      frame = requestAnimationFrame(render);
      board.rotation.z = prefersReducedMotion
        ? -0.006
        : -0.006 + Math.sin(now * 0.00022) * 0.0015;

      for (let index = activeDarts.length - 1; index >= 0; index -= 1) {
        const dart = activeDarts[index];
        const raw = Math.min(1, (now - dart.startedAt) / dart.duration);
        const eased = easeOutCubic(raw);
        dart.group.position.lerpVectors(dart.start, dart.end, eased);
        dart.group.position.y += Math.sin(raw * Math.PI) * 0.62;
        dart.group.rotation.x = -0.04 + raw * 0.13;

        if (raw >= 1 && !dart.reported) {
          dart.reported = true;
          activeDarts.splice(index, 1);
          landedDarts.push(dart.group);
          dart.group.position.copy(dart.end);
          dart.group.rotation.set(0.08, -0.05, (Math.random() - 0.5) * 0.14);
          onHitRef.current(dart.hit);
        }
      }

      renderer.render(scene, camera);
    }

    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", finishPointer);
      renderer.domElement.removeEventListener("pointercancel", finishPointer);
      clearDarts();
      disposeObject(board);
      disposeObject(wall);
      disposeObject(oche);
      disposeObject(reticle);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  const gestureStyle = gesture
    ? {
        left: gesture.startX,
        top: gesture.startY,
        width: Math.hypot(gesture.endX - gesture.startX, gesture.endY - gesture.startY),
        transform: `rotate(${Math.atan2(gesture.endY - gesture.startY, gesture.endX - gesture.startX)}rad)`,
      }
    : undefined;

  return (
    <div
      className={`${styles.sceneShell} ${disabled ? styles.sceneDisabled : ""}`}
      role="img"
      aria-label="A three-dimensional regulation dartboard. Drag upward and release over a target to throw."
    >
      <div ref={mountRef} className={styles.sceneMount} />
      {gesture ? <span className={styles.gestureLine} style={gestureStyle} aria-hidden="true" /> : null}
      <div className={styles.throwHint} aria-hidden="true">
        <span className={styles.swipeGlyph}>↑</span>
        {disabled ? "Waiting for the other player" : hint}
      </div>
      <div className={styles.sceneVignette} aria-hidden="true" />
    </div>
  );
});
