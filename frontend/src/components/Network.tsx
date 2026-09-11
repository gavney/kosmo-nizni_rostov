import { useMemo } from "react";
import { Color } from "three";
import type { Snapshot } from "../types";
import { ecefToThree } from "../format";

function nodeMap(snapshot: Snapshot) {
  const map = new Map<string, [number, number, number]>();
  for (const sat of snapshot.satellites) {
    map.set(sat.id, ecefToThree(sat.x_km, sat.y_km, sat.z_km));
  }
  for (const g of snapshot.ground) {
    map.set(g.id, ecefToThree(g.x_km, g.y_km, g.z_km));
  }
  return map;
}

export default function Network({
  snapshot,
  routePath,
}: {
  snapshot: Snapshot;
  routePath: string[];
}) {
  const positions = useMemo(() => nodeMap(snapshot), [snapshot]);
  const satPoints = useMemo(() => {
    const active: number[] = [];
    const inactive: number[] = [];
    for (const sat of snapshot.satellites) {
      const p = positions.get(sat.id);
      if (!p) continue;
      (sat.active ? active : inactive).push(...p);
    }
    return { active: new Float32Array(active), inactive: new Float32Array(inactive) };
  }, [positions, snapshot.satellites]);

  const isl = useMemo(() => {
    const ground = new Set(snapshot.ground.map((g) => g.id));
    const coords: number[] = [];
    for (const [a, b] of snapshot.edges) {
      if (ground.has(a) || ground.has(b)) continue;
      const pa = positions.get(a);
      const pb = positions.get(b);
      if (!pa || !pb) continue;
      coords.push(...pa, ...pb);
    }
    return new Float32Array(coords);
  }, [positions, snapshot.edges, snapshot.ground]);

  const groundLinks = useMemo(() => {
    const ground = new Set(snapshot.ground.map((g) => g.id));
    const coords: number[] = [];
    for (const [a, b] of snapshot.edges) {
      if (!ground.has(a) && !ground.has(b)) continue;
      const pa = positions.get(a);
      const pb = positions.get(b);
      if (!pa || !pb) continue;
      coords.push(...pa, ...pb);
    }
    return new Float32Array(coords);
  }, [positions, snapshot.edges, snapshot.ground]);

  const route = useMemo(() => {
    const coords: number[] = [];
    for (let i = 0; i < routePath.length - 1; i += 1) {
      const pa = positions.get(routePath[i]);
      const pb = positions.get(routePath[i + 1]);
      if (!pa || !pb) continue;
      coords.push(...pa, ...pb);
    }
    return new Float32Array(coords);
  }, [positions, routePath]);

  return (
    <group>
      {satPoints.inactive.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[satPoints.inactive, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#5d6b73" size={0.012} sizeAttenuation />
        </points>
      )}
      {satPoints.active.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[satPoints.active, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#7fe7dc" size={0.022} sizeAttenuation />
        </points>
      )}
      {isl.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[isl, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#2f8f9a" transparent opacity={0.28} />
        </lineSegments>
      )}
      {groundLinks.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[groundLinks, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#d7a35a" transparent opacity={0.55} />
        </lineSegments>
      )}
      {route.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[route, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#f2d37a" linewidth={2} />
        </lineSegments>
      )}
      {snapshot.ground.map((g) => {
        const p = positions.get(g.id);
        if (!p) return null;
        const isGw = g.role === "gateway";
        return (
          <mesh key={g.id} position={p}>
            <sphereGeometry args={[isGw ? 0.028 : 0.02, 16, 16]} />
            <meshBasicMaterial color={new Color(isGw ? "#f0b45a" : "#9ee7c2")} />
          </mesh>
        );
      })}
    </group>
  );
}
