import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, MOUSE, SRGBColorSpace, TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Snapshot } from "../types";
import { ecefToThree, latLonToThree } from "../format";
import CrispStarfield from "./CrispStarfield";
import Earth from "./Earth";
import Network, { type DisplayRoute } from "./Network";
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
    if (loaded > 0 && !active) {
      setFade(true);
      const id = window.setTimeout(() => setVisible(false), 420);
      return () => window.clearTimeout(id);
    }
  }, [active, loaded, visible]);

  useEffect(() => {
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
  const homePos = useRef(new Vector3(...EUROPE_VIEW.pos));
  const homeTarget = useRef(new Vector3(...EUROPE_VIEW.target));
  const approached = useRef(false);
  const goingHome = useRef(false);
  const prevFollow = useRef<string | null>(null);

  useEffect(() => {
    approached.current = false;
  }, [followId]);

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const k = 1 - Math.exp(-4.0 * Math.min(dt, 0.05));

    if (prevFollow.current && !followId) {
      goingHome.current = true;
    }
    prevFollow.current = followId;

    if (followId && position) {
      goingHome.current = false;
      const sat = new Vector3(...position);
      // OrbitControls keeps spherical offset vs target → camera flies with the sat.
      controls.target.lerp(sat, k);
      controls.minDistance = 0.12;
      controls.maxDistance = 5.2;

      if (!approached.current) {
        const radial = sat.clone().normalize();
        const tangent = new Vector3().crossVectors(radial, new Vector3(0, 1, 0));
        if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
        tangent.normalize();
        desiredCam.current.copy(sat).addScaledVector(radial, 0.52).addScaledVector(tangent, 0.2);
        camera.position.lerp(desiredCam.current, k);
        if (camera.position.distanceTo(desiredCam.current) < 0.05) approached.current = true;
      }
      controls.update();
      return;
    }

    if (goingHome.current) {
      controls.minDistance = 1.2;
      controls.maxDistance = 5.2;
      camera.position.lerp(homePos.current, k);
      controls.target.lerp(homeTarget.current, k);
      controls.update();
      if (
        camera.position.distanceTo(homePos.current) < 0.04 &&
        controls.target.distanceTo(homeTarget.current) < 0.02
      ) {
        goingHome.current = false;
      }
    }
  });
  return null;
}

function GlobeScene({
  snapshot,
  routes,
  followedId,
  criticalIds,
  planeOf,
  layers,
  playing,
  blendSec,
  onSatPick,
}: {
  snapshot: Snapshot | null;
  routes: DisplayRoute[];
  followedId: string | null;
  criticalIds: string[];
  planeOf: Record<string, string>;
  layers: {
    isl: boolean;
    orbits: boolean;
    coverage: boolean;
    critical: boolean;
    labels: boolean;
    backup: boolean;
  };
  playing: boolean;
  blendSec: number;
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
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = SRGBColorSpace;
      }}
    >
      <color attach="background" args={["#000000"]} />
      <CrispStarfield count={10000} radius={100} depth={80} />
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
            routes={routes}
            followedId={followedId}
            criticalIds={criticalIds}
            planeOf={planeOf}
            showIsl={layers.isl}
            showOrbits={layers.orbits}
            showCoverage={layers.coverage}
            showCritical={layers.critical}
            showLabels={layers.labels}
            showBackup={layers.backup}
            lite={playing}
            blendSec={blendSec}
            onSatPick={onSatPick}
          />
        )}
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        enablePan
        screenSpacePanning
        panSpeed={1.05}
        enableRotate
        rotateSpeed={0.72}
        enableZoom
        zoomSpeed={0.9}
        minDistance={followedId ? 0.12 : 1.2}
        maxDistance={5.2}
        autoRotate={false}
        enableDamping
        dampingFactor={0.06}
        mouseButtons={{
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.PAN,
          RIGHT: MOUSE.PAN,
        }}
        touches={{
          ONE: TOUCH.ROTATE,
          TWO: TOUCH.DOLLY_PAN,
        }}
      />
    </Canvas>
  );
}

export default function Globe(props: {
  snapshot: Snapshot | null;
  routes: DisplayRoute[];
  followedId: string | null;
  criticalIds?: string[];
  planeOf?: Record<string, string>;
  layers?: {
    isl: boolean;
    orbits: boolean;
    coverage: boolean;
    critical: boolean;
    labels: boolean;
    backup: boolean;
  };
  playing?: boolean;
  blendSec?: number;
  onSatPick: (id: string) => void;
}) {
  const layers = props.layers ?? {
    isl: true,
    orbits: true,
    coverage: true,
    critical: true,
    labels: true,
    backup: false,
  };
  return (
    <ErrorBoundary fallback={<div className="globe-fallback">Глобус не загрузился — панель расчёта справа работает.</div>}>
      <div
        className="globe-root"
        onContextMenu={(e) => {
          e.preventDefault();
        }}
      >
        <GlobeBootOverlay />
        <GlobeScene
          {...props}
          layers={layers}
          criticalIds={props.criticalIds ?? []}
          planeOf={props.planeOf ?? {}}
          playing={Boolean(props.playing)}
          blendSec={props.blendSec ?? 0.28}
        />
      </div>
    </ErrorBoundary>
  );
}
