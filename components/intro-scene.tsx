"use client";
import { useEffect, useRef, type MutableRefObject } from "react";
import type * as THREE from "three";
import { scenePose, objectPose, logoTilt } from "@/lib/intro-motion";

export default function IntroScene({
  progress,
  reducedMotion,
}: {
  progress: MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    paused = useRef(reducedMotion);
  paused.current = reducedMotion;
  useEffect(() => {
    let disposed = false,
      frame = 0,
      cleanup = () => {};
    const init = async () => {
      const T = await import("three");
      const { RoomEnvironment } =
        await import("three/addons/environments/RoomEnvironment.js");
      if (disposed || !host.current) return;
      const container = host.current;
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new T.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
      } catch {
        container.dataset.fallback = "true";
        return;
      }
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, innerWidth < 700 ? 1 : 1.25),
      );
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.domElement.setAttribute("aria-hidden", "true");
      container.appendChild(renderer.domElement);
      const scene = new T.Scene();
      scene.fog = new T.FogExp2("#101312", 0.035);
      const pmrem = new T.PMREMGenerator(renderer),
        room = new RoomEnvironment(),
        env = pmrem.fromScene(room, 0.04);
      scene.environment = env.texture;
      room.dispose();
      scene.add(new T.HemisphereLight("#e2f9e8", "#111713", 1.8));
      const key = new T.DirectionalLight("#c0f3cb", 3.2);
      key.position.set(-2, 8, 9);
      scene.add(key);
      const fill = new T.DirectionalLight("#b8a4df", 1.9);
      fill.position.set(8, 3, -3);
      scene.add(fill);
      const camera = new T.PerspectiveCamera(36, 1, 0.1, 80);
      const target = new T.Vector3(0, 1.9, 0);
      const grid = new T.GridHelper(45, 42, "#51745a", "#2d3c32");
      grid.position.set(0, -0.65, -8);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.18;
      scene.add(grid);
      const groups = Array.from({ length: 4 }, () => new T.Group());
      groups.forEach((g) => scene.add(g));
      const mint = () =>
        new T.MeshPhysicalMaterial({
          color: "#a7d9b1",
          metalness: 0.6,
          roughness: 0.25,
          clearcoat: 0.8,
        });
      const graphite = () =>
        new T.MeshPhysicalMaterial({
          color: "#424c47",
          metalness: 0.6,
          roughness: 0.28,
          clearcoat: 0.6,
        });
      const lineMat = (color = "#79a386", opacity = 0.4) =>
        new T.LineBasicMaterial({ color, transparent: true, opacity });
      const meshLine = (
        geometry: THREE.BufferGeometry,
        color = "#79a386",
        opacity = 0.4,
      ) =>
        new T.LineSegments(
          new T.EdgesGeometry(geometry),
          lineMat(color, opacity),
        );
      function arc(
        group: THREE.Group,
        radius: number,
        tilt: number,
        color: string,
      ) {
        const points = Array.from({ length: 110 }, (_, i) => {
          const a = (i / 109) * Math.PI * 2;
          return new T.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0);
        });
        const geometry = new T.BufferGeometry().setFromPoints(points);
        const ring = new T.LineLoop(geometry, lineMat(color, 0.34));
        ring.rotation.set(tilt, 0.3, 0.1);
        group.add(ring);
        return ring;
      }
      function node(
        group: THREE.Group,
        x: number,
        y: number,
        z: number,
        r = 0.08,
      ) {
        const dot = new T.Mesh(
          new T.SphereGeometry(r, 12, 10),
          new T.MeshBasicMaterial({ color: "#b8e9c3" }),
        );
        dot.position.set(x, y, z);
        group.add(dot);
      }
      function link(group: THREE.Group, points: number[][], opacity = 0.5) {
        const curve = new T.CatmullRomCurve3(
          points.map((p) => new T.Vector3(...(p as [number, number, number]))),
        );
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints(curve.getPoints(64)),
          lineMat("#719d7c", opacity),
        );
        group.add(line);
      }
      const logo = new T.Group();
      const shape = (points: number[][]) => {
        const s = new T.Shape();
        points.forEach(([x, y], i) =>
          i
            ? s.lineTo((x - 17) * 0.085, (20 - y) * 0.085)
            : s.moveTo((x - 17) * 0.085, (20 - y) * 0.085),
        );
        s.closePath();
        return s;
      };
      const a = shape([
          [21, 2],
          [7, 16],
          [5, 20],
          [7, 24],
          [14, 31],
          [20, 25],
          [13, 18],
          [27, 4],
        ]),
        b = shape([
          [13, 38],
          [27, 24],
          [29, 20],
          [27, 16],
          [20, 9],
          [14, 15],
          [21, 22],
          [7, 36],
        ]);
      for (const [i, s] of [a, b].entries()) {
        const geometry = new T.ExtrudeGeometry(s, {
          depth: 0.18,
          bevelEnabled: true,
          bevelThickness: 0.035,
          bevelSize: 0.035,
          bevelSegments: 3,
          steps: 1,
        });
        const mesh = new T.Mesh(geometry, i ? graphite() : mint());
        // Distinct depth intervals prevent coplanar overlap/flicker between pieces.
        mesh.position.z = i ? -0.3 : 0.04;
        logo.add(mesh);
      }
      logo.rotation.set(0.06, logoTilt(0), -0.07);
      logo.position.y = 0.3;
      groups[0].add(logo);
      const heroRing = arc(groups[0], 2.3, 1.05, "#9bc7a6");
      arc(groups[0], 2.7, -0.55, "#757c8d");
      [
        [-2, 0.8, 0.2],
        [1.9, 1.2, 0],
        [0.8, -1.8, 0.4],
        [-1.4, -1.4, -0.2],
      ].forEach((p) => node(groups[0], ...(p as [number, number, number])));
      link(
        groups[0],
        [
          [-2, 0.8, 0.2],
          [-1.6, 1.9, -0.4],
          [1.9, 1.2, 0],
        ],
        0.4,
      );
      // Two linked skill tiles express a reciprocal exchange, not a product box.
      for (const [i, x] of [-1.25, 1.25].entries()) {
        const geo = new T.BoxGeometry(1.65, 2.15, 0.16);
        const tile = new T.Mesh(
          geo,
          new T.MeshPhysicalMaterial({
            color: i ? "#555466" : "#40594a",
            metalness: 0.25,
            roughness: 0.4,
            transparent: true,
            opacity: 0.7,
            clearcoat: 0.4,
          }),
        );
        tile.position.set(x, 0.1, i ? -0.35 : 0.05);
        tile.rotation.set(0.05, i ? -0.15 : 0.15, i ? 0.08 : -0.08);
        groups[1].add(tile);
        const edges = meshLine(geo, i ? "#ab9bc6" : "#b3dfbf", 0.7);
        edges.position.copy(tile.position);
        edges.rotation.copy(tile.rotation);
        groups[1].add(edges);
        for (let j = 0; j < 3; j++) {
          const bar = new T.Mesh(
            new T.BoxGeometry(j ? 1.05 : 0.6, 0.035, 0.02),
            new T.MeshBasicMaterial({
              color: i ? "#aa9abf" : "#99cba8",
              transparent: true,
              opacity: j ? 0.35 : 0.8,
            }),
          );
          bar.position.set(x - 0.1, 0.6 - j * 0.4, 0.18);
          groups[1].add(bar);
        }
      }
      link(
        groups[1],
        [
          [-0.5, 0.8, 0.3],
          [0, 1.25, 0.4],
          [0.5, 0.8, 0.3],
        ],
        0.8,
      );
      link(
        groups[1],
        [
          [0.5, -0.5, 0.3],
          [0, -0.95, 0.4],
          [-0.5, -0.5, 0.3],
        ],
        0.8,
      );
      node(groups[1], 0, 1.25, 0.4, 0.07);
      node(groups[1], 0, -0.95, 0.4, 0.07);
      // Connected checkpoints mirror goal -> study plan -> practice -> proof.
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 ? 1 : -1) * 0.95,
          y = 1.3 - Math.floor(i / 2) * 1.75;
        const geo = new T.BoxGeometry(1.4, 1, 0.18);
        const tile = new T.Mesh(
          geo,
          new T.MeshPhysicalMaterial({
            color: i === 3 ? "#567261" : "#303934",
            metalness: 0.4,
            roughness: 0.36,
          }),
        );
        tile.position.set(x, y, -i * 0.1);
        tile.rotation.y = i % 2 ? -0.12 : 0.12;
        groups[2].add(tile);
        const edges = meshLine(geo, "#779985", 0.55);
        edges.position.copy(tile.position);
        edges.rotation.copy(tile.rotation);
        groups[2].add(edges);
        node(groups[2], x, y, 0.2, 0.09);
      }
      link(
        groups[2],
        [
          [-0.95, 1.3, 0.2],
          [0.2, 1.55, 0.25],
          [0.95, 1.3, 0.2],
          [1.5, 0.4, 0.25],
          [-0.95, -0.45, 0.2],
          [0.1, -0.75, 0.25],
          [0.95, -0.45, 0.2],
        ],
        0.65,
      );
      // Login has a quiet network motif. No rotating logo behind the form.
      arc(groups[3], 2.1, 0.4, "#6c9276");
      arc(groups[3], 2.65, -0.7, "#424c49");
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        node(groups[3], Math.cos(angle) * 2.1, Math.sin(angle) * 2.1, 0, 0.055);
      }
      const fades = groups.map((group) => {
        const materials = new Set<THREE.Material>();
        group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.material)
            (Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material]
            ).forEach((m) => materials.add(m));
        });
        return [...materials].map((m) => {
          m.transparent = true;
          return { material: m, base: m.opacity };
        });
      });
      let width = 0,
        redraw = true;
      const resize = () => {
        width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        redraw = true;
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      // Warm every chapter's shaders before scrolling reveals its objects.
      await renderer.compileAsync(scene, camera);
      if (disposed) {
        renderer.dispose();
        env.dispose();
        pmrem.dispose();
        observer.disconnect();
        renderer.domElement.remove();
        return;
      }
      let last = performance.now(),
        time = 0,
        smooth = progress.current,
        rendered = -1;
      const animate = (now: number) => {
        if (disposed) return;
        if (
          document.visibilityState !== "visible" ||
          (progress.current === 3 && rendered === 3 && !redraw)
        ) {
          last = now;
          frame = requestAnimationFrame(animate);
          return;
        }
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const still = paused.current;
        if (!still) time += dt;
        smooth = still
          ? progress.current
          : T.MathUtils.damp(smooth, progress.current, 7, dt);
        if (Math.abs(smooth - progress.current) < 0.001)
          smooth = progress.current;
        const pose = scenePose(smooth);
        camera.position.set(pose.cameraX, pose.cameraY, pose.cameraZ);
        camera.lookAt(target);
        groups.forEach((group, i) => {
          const p = objectPose(i, smooth);
          group.visible = p.visible;
          const mobile = width < 700;
          const anchor = i === 3 ? (mobile ? 0 : -2.7) : mobile ? 0 : 2.75;
          group.position.set(
            anchor + p.offsetX,
            (mobile ? 3.1 : 2.1) +
              p.offsetY +
              (still ? 0 : Math.sin(time * 0.6 + i) * 0.035),
            p.offsetZ,
          );
          group.scale.setScalar(p.scale * (mobile ? 0.72 : 0.94));
          fades[i].forEach(({ material, base }) => {
            material.opacity = base * p.opacity;
            material.depthWrite = p.opacity > 0.98;
          });
        });
        logo.rotation.y = logoTilt(time);
        heroRing.rotation.z = 0.1 + Math.sin(time * 0.25) * 0.035;
        if (
          document.visibilityState === "visible" &&
          (!still || redraw || rendered !== smooth)
        ) {
          renderer.render(scene, camera);
          rendered = smooth;
          redraw = false;
        }
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      container.dataset.ready = "true";
      cleanup = () => {
        observer.disconnect();
        const geometries = new Set<THREE.BufferGeometry>(),
          materials = new Set<THREE.Material>();
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) geometries.add(mesh.geometry);
          if (mesh.material)
            (Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material]
            ).forEach((m) => materials.add(m));
        });
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        env.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    };
    init().catch(() => {
      if (host.current) host.current.dataset.fallback = "true";
      cleanup();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [progress]);
  return (
    <div className="intro-canvas" ref={host} aria-hidden="true">
      <div className="scene-fallback">
        <span>↔</span>
      </div>
    </div>
  );
}
