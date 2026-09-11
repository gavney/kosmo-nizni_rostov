import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense } from "react";
import type { Snapshot } from "../types";
import { ecefToThree } from "../format";
import Earth from "./Earth";
import Network from "./Network";

export default function Globe({
  snapshot,
  routePath,
}: {
  snapshot: Snapshot | null;
  routePath: string[];
}) {
  const sun = snapshot ? ecefToThree(snapshot.sun_ecef[0], snapshot.sun_ecef[1], snapshot.sun_ecef[2], 1) : [1, 0.2, 0.3];

  return (
    <Canvas camera={{ position: [0, 0.35, 2.55], fov: 42 }} gl={{ antialias: true }}>
      <color attach="background" args={["#05090d"]} />
      <ambientLight intensity={0.22} />
      <Stars radius={80} depth={40} count={4000} factor={3} saturation={0} fade speed={0.4} />
      <Suspense fallback={null}>
        <Earth sun={sun as [number, number, number]} />
        {snapshot && <Network snapshot={snapshot} routePath={routePath} />}
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        autoRotate
        autoRotateSpeed={0.18}
      />
    </Canvas>
  );
}
