import { msg } from "../i18n/core";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Snapshot, WorldDescription } from "../types";
export class DuckScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.005, 100);
  controls: OrbitControls;
  meshes = new Map<number, THREE.Mesh>();
  follow = true;
  lastPosition = new THREE.Vector3();
  hasPosition = false;
  frame = 0;
  floor: THREE.Mesh;
  constructor(
    public canvas: HTMLCanvasElement,
    onError: (message: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor("#dfeae3");
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.fog = new THREE.Fog("#dfeae3", 2, 8);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 3.5;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.screenSpacePanning = true;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.scene.add(new THREE.HemisphereLight("#f6fff9", "#879989", 2.4));
    const sun = new THREE.DirectionalLight("#fffaf1", 2.1);
    sun.position.set(-1.2, -1.8, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -1;
    sun.shadow.camera.right = 1;
    sun.shadow.camera.top = 1;
    sun.shadow.camera.bottom = -1;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 7;
    sun.shadow.normalBias = 0.0006;
    sun.shadow.bias = -0.00004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: "#d9e5db", roughness: 1 }),
    );
    this.floor.receiveShadow = true;
    this.floor.position.z = -0.001;
    this.scene.add(this.floor);
    const grid = new THREE.GridHelper(40, 200, "#afc4b6", "#c7d7cb");
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.0001;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.38;
    this.scene.add(grid);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.home();
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      onError(msg("图形上下文暂时丢失，正在等待浏览器恢复"));
    });
    canvas.addEventListener("webglcontextrestored", () =>
      onError(msg("图形已恢复，可在菜单继续仿真")),
    );
    const draw = () => {
      this.frame = requestAnimationFrame(draw);
      this.controls.update();
      if (this.hasPosition) {
        sun.position.set(
          this.lastPosition.x - 1.2,
          this.lastPosition.y - 1.8,
          3,
        );
        sun.target.position.set(this.lastPosition.x, this.lastPosition.y, 0);
      }
      this.renderer.render(this.scene, this.camera);
    };
    draw();
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  home() {
    const p = this.hasPosition
      ? this.lastPosition
      : new THREE.Vector3(0, 0, 0.12);
    this.controls.target.set(p.x, p.y, 0.14);
    const distance = this.camera.aspect < 0.85 ? 1.12 : 0.85;
    this.camera.position.set(
      p.x + distance * 0.66,
      p.y - distance * 0.75,
      0.14 + distance * 0.35,
    );
    this.controls.update();
  }
  setup(world: WorldDescription) {
    for (const g of world.geoms) {
      if (g.type === 0) continue;
      let geometry: THREE.BufferGeometry;
      if (g.type === 7 && g.vertices && g.normals) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(g.vertices, 3),
        );
        geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(g.normals, 3),
        );
      } else if (g.type === 2)
        geometry = new THREE.SphereGeometry(g.size[0], 32, 20);
      else if (g.type === 6)
        geometry = new THREE.BoxGeometry(
          g.size[0] * 2,
          g.size[1] * 2,
          g.size[2] * 2,
        );
      else continue;
      const color = new THREE.Color().setRGB(
        g.color[0],
        g.color[1],
        g.color[2],
        THREE.LinearSRGBColorSpace,
      );
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.12,
        transparent: g.color[3] < 1,
        opacity: g.color[3],
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.meshes.set(g.id, mesh);
      this.scene.add(mesh);
      if (g.type === 2) {
        const lines = new THREE.LineSegments(
          new THREE.EdgesGeometry(
            new THREE.IcosahedronGeometry(g.size[0] * 1.008, 1),
          ),
          new THREE.LineBasicMaterial({
            color: "#865421",
            transparent: true,
            opacity: 0.6,
          }),
        );
        mesh.add(lines);
      }
    }
  }
  update(s: Snapshot) {
    const p = new THREE.Vector3(...(s.position as [number, number, number]));
    if (this.follow && this.hasPosition) {
      const delta = p.clone().sub(this.lastPosition);
      delta.z = 0;
      this.camera.position.add(delta);
      this.controls.target.add(delta);
    }
    this.lastPosition.copy(p);
    this.hasPosition = true;
    for (const [id, mesh] of this.meshes) {
      const b = id * 9,
        o = id * 3,
        r = s.geomMat,
        t = s.geomPos;
      mesh.matrix.set(
        r[b],
        r[b + 1],
        r[b + 2],
        t[o],
        r[b + 3],
        r[b + 4],
        r[b + 5],
        t[o + 1],
        r[b + 6],
        r[b + 7],
        r[b + 8],
        t[o + 2],
        0,
        0,
        0,
        1,
      );
      mesh.matrixWorldNeedsUpdate = true;
    }
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.controls.dispose();
    for (const m of this.meshes.values()) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.renderer.dispose();
  }
}
