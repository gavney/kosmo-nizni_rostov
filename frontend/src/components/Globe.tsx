import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useProgress } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Snapshot } from "../types";
import { ecefToThree, latLonToThree } from "../format";
import Earth from "./Earth";
import Network from "./Network";
import ErrorBoundary from "./ErrorBoundary";

const EUROPE_VIEW = {
  pos: latLonToThree(40, 12, 2.55),
  target: [0, 0.28, 0] as [number, number, number],
};

function GlobeBootOverlay() {
  const { active, progress, loaded } = useProgress();
  const [visible, setVisible] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // Wait until at least one asset finished and the manager is idle.
    if (loaded > 0 && !active) {
      setFade(true);
      const id = window.setTimeout(() => setVisible(false), 420);
      return () => window.clearTimeout(id);
    }
  }, [active, loaded, visible]);

  useEffect(() => {
    // Safety: never block the UI forever if progress events are missed.
    const id = window.setTimeout(() => {
      setFade(true);
      window.setTimeout(() => setVisible(false), 420);
    }, 12000);
    return () => window.clearTimeout(id);
  }, []);

  if (!visible) return null;

  const pct = Math.min(100, Math.round(progress || (loaded > 0 ? 100 : 0)));

  return (
    <div className={`globe-boot${fade ? " is-done" : ""}`} aria-live="polite">
      <div className="globe-boot-card glass">
        <p className="brand">Polar Mesh</p>
        <p className="sub">Ждём зарождения жизни…</p>
        <div className="globe-boot-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(8, pct)}%` }} />
        </div>
        <p className="hint">{pct}%</p>
      </div>
    </div>
  );
}

function CameraRig({
  snapshot,
  controlsRef,
}: {
  snapshot: Snapshot | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const framed = useRef(false);
  useLayoutEffect(() => {
    if (framed.current || !snapshot) return;
    framed.current = true;
    camera.position.set(...EUROPE_VIEW.pos);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...EUROPE_VIEW.target);
      controls.update();
    } else {
      camera.lookAt(new Vector3(...EUROPE_VIEW.target));
    }
  }, [camera, snapshot, controlsRef]);
  return null;
}

function Tracker({
  followId,
  position,
  controlsRef,
}: {
  followId: string | null;
  position: [number, number, number] | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const desiredCam = useRef(new Vector3());
  const desiredTarget = useRef(new Vector3());

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!followId || !position || !controls) {
      if (controls && !followId) {
        controls.minDistance = 1.38;
        controls.maxDistance = 4.6;
      }
      return;
    }
    const sat = new Vector3(...position);
    const radial = sat.clone().normalize();
    const tangent = new Vector3().crossVectors(radial, new Vector3(0, 1, 0));
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
    tangent.normalize();
    desiredTarget.current.copy(sat);
    desiredCam.current.copy(sat).add(radial.multiplyScalar(0.52)).add(tangent.multiplyScalar(0.2));
    const k = 1 - Math.exp(-4.2 * Math.min(dt, 0.05));
    camera.position.lerp(desiredCam.current, k);
    controls.target.lerp(desiredTarget.current, k);
    controls.minDistance = 0.18;
    controls.maxDistance = 3.4;
    controls.update();
  });
  return null;
}

function GlobeScene({
  snapshot,
  routePath,
  connected,
  followedId,
  playing,
  onSatPick,
}: {
  snapshot: Snapshot | null;
  routePath: string[];
  connected: boolean;
  followedId: string | null;
  playing: boolean;
  onSatPick: (id: string) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const sun = snapshot
    ? ([snapshot.sun_ecef[0], snapshot.sun_ecef[2], -snapshot.sun_ecef[1]] as [number, number, number])
    : ([0.92, 0.08, 0.38] as [number, number, number]);
  const sat = snapshot && followedId ? snapshot.satellites.find((item) => item.id === followedId) : undefined;
  const followPos = sat ? ecefToThree(sat.x_km, sat.y_km, sat.z_km) : null;

  return (
    <Canvas
      camera={{ position: EUROPE_VIEW.pos, fov: 36, near: 0.08, far: 200 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = SRGBColorSpace;
      }}
    >
      <color attach="background" args={["#000000"]} />
      <Stars radius={70} depth={30} count={1200} factor={1.6} saturation={0.04} fade speed={0.03} />
      <CameraRig snapshot={snapshot} controlsRef={controlsRef} />
      <Tracker followId={followedId} position={followPos} controlsRef={controlsRef} />
      <Suspense
        fallback={
          <mesh>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color="#0a1524" />
          </mesh>
        }
      >
        <Earth sun={sun} />
        {snapshot && (
          <Network
            snapshot={snapshot}
            routePath={routePath}
            connected={connected}
            followedId={followedId}
            lite={playing}
            onSatPick={onSatPick}
          />
        )}
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={followedId ? 0.18 : 1.38}
        maxDistance={4.6}
        autoRotate={false}
        enableDamping
        dampingFactor={0.06}
      />
    </Canvas>
  );
}

export default function Globe(props: {
  snapshot: Snapshot | null;
  routePath: string[];
  connected: boolean;
  followedId: string | null;
  playing?: boolean;
  onSatPick: (id: string) => void;
}) {
  return (
    <ErrorBoundary fallback={<div className="globe-fallback">Глобус не загрузился — панель расчёта справа работает.</div>}>
      <div className="globe-root">
        <GlobeBootOverlay />
        <GlobeScene playing={Boolean(props.playing)} {...props} />
      </div>
    </ErrorBoundary>
  );
}
