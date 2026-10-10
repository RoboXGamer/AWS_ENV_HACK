import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PRODUCT_COLORS, surfaceArea } from '../engine';
import type { PackedBox, Product } from '../engine';

interface Props {
  box: PackedBox;
  products: Product[];
  autoRotate: boolean;
  showLabels: boolean;
}

function colorFor(productId: string, products: Product[]): string {
  const idx = products.findIndex((p) => p.id === productId);
  return PRODUCT_COLORS[(idx < 0 ? 0 : idx) % PRODUCT_COLORS.length];
}

function makeLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(8, 12, 22, 0.82)';
  ctx.roundRect(0, 0, 256, 64, 12);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#e8eefc';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.renderOrder = 999;
  return sprite;
}

/**
 * Interactive 3D view of a single packed box.
 * Draws the box shell, the items inside it, and a fill indicator.
 */
export function BoxViewer3D({ box, products, autoRotate, showLabels }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);

  // Disposal bookkeeping for per-box resources.
  const disposables = useRef<THREE.Object3D[]>([]);

  // Init the scene once.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080d18');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(1, 2, 1.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
    rim.position.set(-1.5, 0.5, -1);
    scene.add(rim);

    const content = new THREE.Group();
    scene.add(content);
    contentRef.current = content;

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      contentRef.current = null;
    };
  }, []);

  // Rebuild geometry whenever the selected box changes.
  useEffect(() => {
    const content = contentRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!content || !camera || !controls) return;

    // Clear previous contents.
    while (content.children.length) {
      const child = content.children.pop()!;
      content.remove(child);
    }
    for (const d of disposables.current) {
      const anyD = d as THREE.Mesh;
      anyD.geometry?.dispose?.();
      const mat = (anyD as THREE.Mesh).material as THREE.Material | undefined;
      if (mat) mat.dispose();
    }
    disposables.current = [];

    const { length, width, height } = box;

    // Box shell (translucent) so items inside stay visible.
    const shellGeo = new THREE.BoxGeometry(length, height, width);
    const shell = new THREE.Mesh(
      shellGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x4f8cff,
        transparent: true,
        opacity: 0.09,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    shell.position.set(length / 2, height / 2, width / 2);
    content.add(shell);
    const shellEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(shellGeo),
      new THREE.LineBasicMaterial({ color: 0x4f8cff, transparent: true, opacity: 0.75 }),
    );
    shellEdges.position.copy(shell.position);
    content.add(shellEdges);
    disposables.current.push(shell, shellEdges);

    // Items.
    for (const p of box.placements) {
      const color = colorFor(p.productId, products);
      const geo = new THREE.BoxGeometry(p.dx, p.dz, p.dy);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness: 0.45,
          metalness: 0.05,
        }),
      );
      // three's Y is up; our packing space has z up. Centre then offset.
      mesh.position.set(p.x + p.dx / 2, p.z + p.dz / 2, p.y + p.dy / 2);
      content.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.55 }),
      );
      edges.position.copy(mesh.position);
      content.add(edges);
      disposables.current.push(mesh, edges);

      if (showLabels && box.placements.length <= 40) {
        const sprite = makeLabel(p.sku, color);
        const scale = Math.min(p.dx, p.dy, p.dz) * 0.9;
        sprite.scale.set(scale * 2.4, scale * 0.6, 1);
        sprite.position.copy(mesh.position);
        content.add(sprite);
        disposables.current.push(sprite);
      }
    }

    // Frame the box.
    const radius = Math.max(length, width, height);
    camera.position.set(length * 1.5, height * 1.4, width * 1.9);
    controls.target.set(length / 2, height / 2, width / 2);
    camera.near = Math.max(0.1, radius / 100);
    camera.far = radius * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }, [box, products, showLabels]);

  // Auto-rotate toggle.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.4;
  }, [autoRotate]);

  return <div className="viewer3d" ref={mountRef} />;
}

/** Product list for the current box, aggregated by product. */
export function useBoxSummary(box: PackedBox | null, products: Product[]) {
  return useMemo(() => {
    if (!box) return [];
    const map = new Map<string, { count: number; color: string; name: string }>();
    for (const p of box.placements) {
      const cur = map.get(p.productId) ?? {
        count: 0,
        color: colorFor(p.productId, products),
        name: p.name,
      };
      cur.count += 1;
      map.set(p.productId, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ productId: id, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [box, products]);
}

export { colorFor, surfaceArea };