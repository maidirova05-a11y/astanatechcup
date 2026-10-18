/**
 * The 3D hero mascot: loads the Blender build (public/models/robot.glb, made
 * by scripts/blender/robot_assembly.py --export), plays it once, then idles
 * forever. Everything that does not survive glTF — the idle loop, blinks, the
 * camera drift and every glow — is procedural here, mirroring the waves and
 * material keys in the Blender script.
 *
 * This module imports three.js statically, so it must only ever be reached
 * through a dynamic `import()` (HeroRobot3D does that after mount). Nothing
 * here may import from `@/lib` or `@/config`: it ships to the browser.
 */
import {
  AnimationClip,
  AnimationMixer,
  CanvasTexture,
  Color,
  DirectionalLight,
  Euler,
  HemisphereLight,
  ImageLoader,
  LinearMipmapLinearFilter,
  LoopOnce,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Frames at 30fps — `T` in robot_assembly.py. Clip time is frame / 30. */
export const FPS = 30;
export const F = {
  footL: 8,
  torso: 25,
  armL: 35,
  head: 48,
  eyes: 71,
  beacon: 87,
  logo: 93,
  idle: 115,
} as const;

const BUILD_END = F.idle / FPS;
const TAU = Math.PI * 2;
const deg = (d: number) => (d * Math.PI) / 180;

/**
 * The Blender camera (55mm on a 36mm sensor at (5, -16.5, 6.4), tracking
 * (0, 0, 3.7), orbiting on Z from -38° to +4° during the build), in three's
 * Y-up frame. The lens is a touch longer than the video's so the robot fills
 * the hero stage. Keep in step with WEB_LENS in the Blender script, which
 * renders the poster through the same camera.
 */
export const CAMERA = {
  lens: 69,
  x: 5,
  depth: 16.5,
  height: 6.4,
  target: new Vector3(0, 3.5, 0),
  orbitFrom: -38,
  orbitTo: 4,
} as const;

const INK = "#00243c";

/**
 * The model, as a bundler asset: it is served hashed from /_next/static, which
 * caches it as immutable and keeps it clear of the locale proxy (src/proxy.ts
 * would redirect a bare /models/robot.glb to /ru/models/robot.glb).
 */
const MODEL_URL = new URL("../../../public/models/robot.glb", import.meta.url).href;

export type RobotOptions = {
  host: HTMLElement;
  logoUrl: string;
  /** Called once the first frame is on screen. `skipped` = started already built. */
  onReady: (skipped: boolean) => void;
  /** WebGL died or the model failed to load: show the poster instead. */
  onError: () => void;
  /** Asked at ready time: true when the poster is already showing. */
  shouldSkipBuild: () => boolean;
};

export type RobotHandle = { dispose: () => void };

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** Piecewise-linear keys [frame, value] — the material keys from Blender. */
function keys(f: number, k: [number, number][]) {
  if (f <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (f <= k[i][0]) {
      const [f0, v0] = k[i - 1];
      const [f1, v1] = k[i];
      return v0 + ((v1 - v0) * (f - f0)) / (f1 - f0);
    }
  }
  return k[k.length - 1][1];
}

/** Endless sine starting at `start` (frames), faded in over `blend` frames. */
function wave(f: number, amp: number, period: number, start: number, blend: number, phase = 0) {
  if (f <= start) return 0;
  return amp * smooth((f - start) / blend) * Math.sin((TAU * (f - start)) / period + phase);
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,0.75)");
  r.addColorStop(0.6, "rgba(255,255,255,0.18)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The logo over white, as in Blender: its transparent plate reads as the sign face. */
async function logoTexture(url: string, maxAniso: number) {
  const img = await new ImageLoader().loadAsync(url);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.flipY = false; // glTF UV convention
  t.anisotropy = Math.min(8, maxAniso);
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

export async function mountRobot(opts: RobotOptions): Promise<RobotHandle> {
  const { host } = opts;
  let disposed = false;
  let raf = 0;

  const canvas = document.createElement("canvas");
  canvas.className = "robot-canvas";
  canvas.setAttribute("aria-hidden", "true");

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    opts.onError();
    return { dispose: () => {} };
  }
  host.appendChild(canvas);

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  const camera = new PerspectiveCamera(2 * Math.atan(18 / CAMERA.lens) * (180 / Math.PI), 1, 0.5, 80);

  // Hemisphere for the soft studio fill, a warm-white key from the upper left
  // that casts the only shadow, and a cool rim from behind for the silhouette.
  scene.add(new HemisphereLight(0xf3f6ff, 0x8a96b8, 1.1));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(-7, 11, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new DirectionalLight(0xdfe8ff, 0.7);
  fill.position.set(10, 4, 7);
  scene.add(fill);
  const rim = new DirectionalLight(0xcfe0ff, 1.6);
  rim.position.set(3, 10, -7);
  scene.add(rim);

  const textures: Texture[] = [env];
  const materials = new Set<Material>();
  const cleanup: (() => void)[] = [];

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    cleanup.forEach((f) => f());
    scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => materials.add(x));
      else if (mat) materials.add(mat);
    });
    materials.forEach((m) => {
      const anyM = m as Material & { map?: Texture | null };
      if (anyM.map) textures.push(anyM.map);
      m.dispose();
    });
    textures.forEach((t) => t.dispose());
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  const onLost = (e: Event) => {
    e.preventDefault();
    dispose();
    opts.onError();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  cleanup.push(() => canvas.removeEventListener("webglcontextlost", onLost));

  let gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
  let logo: CanvasTexture;
  try {
    [gltf, logo] = await Promise.all([
      new GLTFLoader().loadAsync(MODEL_URL),
      logoTexture(opts.logoUrl, renderer.capabilities.getMaxAnisotropy()),
    ]);
  } catch {
    if (!disposed) {
      dispose();
      opts.onError();
    }
    return { dispose };
  }
  if (disposed) {
    logo.dispose();
    return { dispose };
  }

  const model = gltf.scene;
  scene.add(model);

  // ── Materials: swap in what glTF could not carry ──────────────────────────
  const outline = new MeshBasicMaterial({ color: INK });
  const sparkGold = new MeshBasicMaterial({ color: "#fcd800", toneMapped: false });
  const sparkBlue = new MeshBasicMaterial({ color: "#3d68ff", toneMapped: false });
  let beacon: MeshStandardMaterial | null = null;
  let ring: MeshStandardMaterial | null = null;

  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as MeshStandardMaterial;
    const name = m.name;
    if (name === "Outline") {
      mesh.material = outline;
      mesh.castShadow = true;
      return;
    }
    if (name === "SparkGold" || name === "SparkBlue") {
      mesh.material = name === "SparkGold" ? sparkGold : sparkBlue;
      return;
    }
    materials.add(m);
    if (name === "Logo") {
      m.map = logo;
      m.color.set("#ffffff");
      m.roughness = 0.45;
      m.side = 0; // FrontSide
      m.needsUpdate = true;
    } else if (name === "Beacon") {
      m.emissive.set("#fcd800");
      m.emissiveIntensity = 0;
      beacon = m;
    } else if (name === "Ring") {
      m.emissive.set("#3d68ff");
      m.emissiveIntensity = 0;
      ring = m;
    } else if (name === "Pad") {
      mesh.receiveShadow = true;
      m.roughness = 0.7;
    }
    if (name.startsWith("Confetti")) return;
    if (name !== "Pad" && name !== "Ring") mesh.castShadow = true;
  });

  // ── Nodes the idle drives ─────────────────────────────────────────────────
  const node = (n: string) => model.getObjectByName(n) ?? null;
  const root = node("Robot");
  const head = node("Head");
  const antenna = node("Antenna");
  const earL = node("EarL");
  const earR = node("EarR");
  const eyes = [node("EyeL"), node("EyeR")].filter(Boolean) as Object3D[];
  const ball = node("Ball");
  // The clip ends while the confetti is still in the air; it finishes its
  // fall in code, or is hidden outright when the build was skipped.
  const confetti = model.children.filter((o) => o.name.startsWith("Confetti"));
  let confettiFrom: Vector3[] = [];
  let confettiGone = false;

  // Antenna halo: a soft sprite, since the Blender one is a fresnel shader.
  const haloMat = new SpriteMaterial({
    map: glowTexture(),
    color: new Color("#ffe23a"),
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  materials.add(haloMat);
  const halo = new Sprite(haloMat);
  halo.scale.setScalar(1.25);
  halo.renderOrder = 2;
  if (ball) ball.add(halo);

  // ── The build clip ────────────────────────────────────────────────────────
  const mixer = new AnimationMixer(model);
  const clip = new AnimationClip(
    "build",
    -1,
    gltf.animations.flatMap((c) => c.tracks),
  );
  const action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  // Rest transforms captured when the build ends; the idle is added on top.
  type Rest = { o: Object3D; p: Vector3; q: Quaternion; s: Vector3 };
  let rest: Rest[] | null = null;
  const captureRest = () => {
    rest = [root, head, antenna, earL, earR, ...eyes]
      .filter((o): o is Object3D => !!o)
      .map((o) => ({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
  };
  const restOf = (o: Object3D | null) => rest?.find((r) => r.o === o) ?? null;

  const qTmp = new Quaternion();
  const eTmp = new Euler();
  const turn = (o: Object3D | null, x: number, y: number, z: number) => {
    const r = restOf(o);
    if (!r) return;
    eTmp.set(x, y, z);
    o!.quaternion.copy(r.q).multiply(qTmp.setFromEuler(eTmp));
  };

  // ── Blinks: irregular, sometimes double, like the eye-on blink ────────────
  let nextBlink = 1.2;
  let blinkAt = -10;
  let doubleBlink = false;
  const blinkScale = (s: number) => {
    const d = s - blinkAt;
    const one = (x: number) => (x < 0 || x > 0.2 ? 1 : 1 - 0.92 * Math.sin((Math.PI * x) / 0.2));
    return Math.min(one(d), doubleBlink ? one(d - 0.28) : 1);
  };

  // ── Pointer parallax (fine pointers only; never touch) ────────────────────
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  if (finePointer) {
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    cleanup.push(() => window.removeEventListener("pointermove", onMove));
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  const placeCamera = (thetaDeg: number, lift = 0) => {
    const t = deg(thetaDeg);
    // Blender (x, y, z) → three (x, z, -y), after rotating the rig about Z.
    const bx = CAMERA.x * Math.cos(t) + CAMERA.depth * Math.sin(t);
    const by = CAMERA.x * Math.sin(t) - CAMERA.depth * Math.cos(t);
    camera.position.set(bx, CAMERA.height + lift, -by);
    camera.lookAt(CAMERA.target);
  };

  // ── Size ──────────────────────────────────────────────────────────────────
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) renderer.render(scene, camera);
  });
  ro.observe(host);
  cleanup.push(() => ro.disconnect());

  // ── Loop ──────────────────────────────────────────────────────────────────
  let t = 0; // seconds of robot time (stops while paused)
  let last = 0;
  let running = false;
  let onScreen = true;
  let ready = false;

  const skipTo = () => {
    t = BUILD_END;
    action.time = clip.duration;
    mixer.update(0);
    captureRest();
    confetti.forEach((c) => (c.visible = false));
    confettiGone = true;
  };

  const frame = (now: number) => {
    raf = 0;
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 1 / 15) : 0;
    last = now;
    // Too late to play the build without a jump: the poster is already up.
    let skipped = false;
    if (!ready && opts.shouldSkipBuild()) {
      skipTo();
      skipped = true;
    }
    t += skipped ? 0 : dt;
    const f = t * FPS;

    if (!rest) {
      mixer.update(dt);
      if (t >= BUILD_END) {
        action.time = clip.duration;
        mixer.update(0);
        captureRest();
        confettiFrom = confetti.map((c) => c.position.clone());
      }
    }

    // Glows, from the Blender material keys.
    const b = keys(f, [[F.beacon, 0], [F.beacon + 3, 6], [F.beacon + 10, 2.5]]) +
      wave(f, 1.2, 40, F.beacon + 10, 20);
    if (beacon) (beacon as MeshStandardMaterial).emissiveIntensity = b * 0.32;
    const g = keys(f, [[F.beacon, 0], [F.beacon + 3, 8], [F.beacon + 10, 3]]) +
      wave(f, 1.6, 40, F.beacon + 10, 20);
    haloMat.opacity = clamp01(g / 7);
    halo.scale.setScalar(1.05 + g * 0.06);
    const r = keys(f, [[F.logo, 0], [F.logo + 4, 8], [F.logo + 14, 3]]) +
      wave(f, 1.2, 50, F.logo + 14, 20);
    if (ring) (ring as MeshStandardMaterial).emissiveIntensity = r * 0.22;

    // Idle, from the Blender waves (`wave(...)` calls after the build).
    let theta: number = CAMERA.orbitTo;
    if (rest) {
      const I = F.idle;
      const rr = restOf(root);
      if (root && rr) root.position.y = rr.p.y + wave(f, 0.14, 80, I, 30);
      turn(root, 0, wave(f, deg(7), 160, I, 40), 0);
      turn(head, 0, 0, wave(f, deg(4), 110, I, 30));
      turn(antenna, 0, 0, wave(f, deg(8), 55, I, 20));
      turn(earL, wave(f, deg(10), 70, I, 20, -1), 0, 0);
      turn(earR, wave(f, deg(10), 70, I, 20, 1), 0, 0);

      const s = t - BUILD_END;
      if (!confettiGone) {
        const k = clamp01(1 - s / 0.5);
        confetti.forEach((c, i) => {
          const from = confettiFrom[i];
          if (from) c.position.set(from.x, from.y - 3.2 * s * s - 1.2 * s, from.z);
          c.scale.setScalar(k);
          c.visible = k > 0;
        });
        confettiGone = k === 0;
      }
      if (s > nextBlink) {
        blinkAt = s;
        doubleBlink = Math.random() < 0.25;
        nextBlink = s + 2.6 + Math.random() * 3.2;
      }
      const k = blinkScale(s);
      for (const e of eyes) {
        const er = restOf(e);
        if (er) e.scale.set(er.s.x, er.s.y * k, er.s.z);
      }
      theta = CAMERA.orbitTo + wave(f, 5, 240, I, 40);
    } else {
      theta = CAMERA.orbitFrom +
        (CAMERA.orbitTo - CAMERA.orbitFrom) * easeInOutSine(clamp01((f - 1) / (F.idle - 1)));
    }

    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    placeCamera(theta + px * 4, -py * 0.5);

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      opts.onReady(skipped);
    }
    raf = requestAnimationFrame(frame);
  };

  const update = () => {
    const should = onScreen && document.visibilityState === "visible" && !disposed;
    if (should === running) return;
    running = should;
    if (running) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    update();
  });
  io.observe(host);
  cleanup.push(() => io.disconnect());
  const onVis = () => update();
  document.addEventListener("visibilitychange", onVis);
  cleanup.push(() => document.removeEventListener("visibilitychange", onVis));

  // Compile shaders before the first visible frame, so the build starts clean.
  placeCamera(CAMERA.orbitFrom);
  renderer.compile(scene, camera);
  update();

  return { dispose };
}
