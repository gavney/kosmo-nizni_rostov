import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { Billboard, Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, Vector3 } from "three";
import type { Line2 } from "three-stdlib";
import type { Snapshot } from "../types";
import { ecefToThree, latLonToThree } from "../format";

const GEO_LABELS: { name: string; lat: number; lon: number }[] = [
  { name: "РОССИЯ", lat: 60.0, lon: 88.0 },
  { name: "КАЗАХСТАН", lat: 48.2, lon: 67.0 },
  { name: "МОНГОЛИЯ", lat: 46.8, lon: 103.8 },
  { name: "КИТАЙ", lat: 35.8, lon: 104.0 },
];

const NADIR = "#46ff6a";
const SAT = "#8ec8e8";
const SAT_DIM = "#445560";
const SAT_ROUTE = "#d7eef8";
const GATEWAY = "#f0b24a";
const CLIENT = "#6fdb9a";
const ISL = "#3aa8b8";
const ISL_HOT = "#6eefe0";
const ROUTE = "#f6f3ea";
const BLEND_S = 0.12;
const UP = new Vector3(0, 1, 0);
const _n = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _p = new Vector3();
const _world = new Vector3();

type PosMap = Map<string, Vector3>;

function copyInto(dst: PosMap, src: PosMap) {
  for (const [id, v] of src) {
    let cur = dst.get(id);
    if (!cur) {
      cur = v.clone();
      dst.set(id, cur);
    } else {
      cur.copy(v);
    }
  }
}

function fillTargets(snapshot: Snapshot, into: PosMap) {
  for (const sat of snapshot.satellites) {
    const xyz = ecefToThree(sat.x_km, sat.y_km, sat.z_km);
    let cur = into.get(sat.id);
    if (!cur) {
      cur = new Vector3(...xyz);
      into.set(sat.id, cur);
    } else {
      cur.set(...xyz);
    }
  }
  for (const g of snapshot.ground) {
    const xyz = ecefToThree(g.x_km, g.y_km, g.z_km);
    let cur = into.get(g.id);
    if (!cur) {
      cur = new Vector3(...xyz);
      into.set(g.id, cur);
    } else {
      cur.set(...xyz);
    }
  }
  return into;
}

function useSmoothedPositions(snapshot: Snapshot): MutableRefObject<PosMap> {
  const current = useRef<PosMap>(new Map());
  const from = useRef<PosMap>(new Map());
  const to = useRef<PosMap>(new Map());
  const started = useRef(0);
  const blending = useRef(false);

  useEffect(() => {
    if (current.current.size === 0) {
      fillTargets(snapshot, to.current);
      copyInto(current.current, to.current);
      copyInto(from.current, to.current);
      started.current = performance.now() - BLEND_S * 1000;
      blending.current = false;
      return;
    }
    copyInto(from.current, current.current);
    fillTargets(snapshot, to.current);
    started.current = performance.now();
    blending.current = true;
  }, [snapshot]);

  useFrame(() => {
    if (!blending.current && to.current.size === current.current.size) {
      // still lerp briefly after jump; cheap early-out when settled
      const age = performance.now() - started.current;
      if (age > BLEND_S * 1000) return;
    }
    const u = Math.min(1, (performance.now() - started.current) / (BLEND_S * 1000));
    const s = u * u * (3 - 2 * u);
    for (const [id, tgt] of to.current) {
      let cur = current.current.get(id);
      const origin = from.current.get(id) ?? tgt;
      if (!cur) {
        cur = origin.clone();
        current.current.set(id, cur);
      }
      cur.lerpVectors(origin, tgt, s);
    }
    if (u >= 1) blending.current = false;
  });

  return current;
}

function FacingHtml({
  position,
  children,
}: {
  position: [number, number, number];
  children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  useFrame(({ camera }) => {
    const el = wrap.current;
    const g = groupRef.current;
    if (!el || !g) return;
    g.getWorldPosition(_world);
    const facing =
      _world.dot(camera.position) > 0.08 * Math.max(_world.length(), 0.2) * camera.position.length();
    if (facing === visible.current) return;
    visible.current = facing;
    el.style.opacity = facing ? "1" : "0";
  });
  return (
    <group ref={groupRef} position={position}>
      <Html center style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
        <div ref={wrap}>{children}</div>
      </Html>
    </group>
  );
}

function MovingLine({
  a,
  b,
  positions,
  color,
  lineWidth,
  opacity,
  lift = 0,
  throttle = false,
}: {
  a: string;
  b: string;
  positions: MutableRefObject<PosMap>;
  color: string;
  lineWidth: number;
  opacity: number;
  lift?: number;
  throttle?: boolean;
}) {
  const ref = useRef<Line2>(null);
  const tick = useRef(0);
  const steps = lift > 0 ? 10 : 2;
  const seed = useMemo(
    () => Array.from({ length: steps }, (_, i) => [0, i * 0.01, 0] as [number, number, number]),
    [steps],
  );

  useFrame(() => {
    tick.current += 1;
    if (throttle && tick.current % 2 !== 0) return;
    const pa = positions.current.get(a);
    const pb = positions.current.get(b);
    const line = ref.current;
    if (!pa || !pb || !line?.geometry) return;
    const arr: number[] = [];
    if (lift <= 0) {
      arr.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    } else {
      for (let i = 0; i < steps; i += 1) {
        const t = i / (steps - 1);
        _p.lerpVectors(pa, pb, t);
        const len = _p.length();
        const extra = Math.sin(Math.PI * t) * lift;
        if (len > 1e-6) _p.multiplyScalar((len + extra) / len);
        arr.push(_p.x, _p.y, _p.z);
      }
    }
    line.geometry.setPositions(arr);
  });

  return (
    <Line
      ref={ref}
      points={seed}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      depthWrite={false}
    />
  );
}

function SatDot({
  id,
  active,
  followed,
  onRoute,
  positions,
  onPick,
  showLabel = true,
}: {
  id: string;
  active: boolean;
  followed: boolean;
  onRoute: boolean;
  positions: MutableRefObject<PosMap>;
  onPick: (id: string) => void;
  showLabel?: boolean;
}) {
  const ref = useRef<Group>(null);
  const size = followed ? 0.0075 : onRoute ? 0.0058 : 0.0042;
  const color = followed ? NADIR : onRoute ? SAT_ROUTE : active ? SAT : SAT_DIM;
  useFrame(() => {
    const p = positions.current.get(id);
    if (p && ref.current) ref.current.position.copy(p);
  });
  return (
    <group ref={ref}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onPick(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[size, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={active || followed ? 0.95 : 0.4} />
      </mesh>
      <mesh
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onPick(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshBasicMaterial />
      </mesh>
      {showLabel && (followed || onRoute) && (
        <FacingHtml position={[0, 0.016, 0]}>
          <div className={`globe-label ${followed ? "globe-label-follow" : "globe-label-sat"}`}>{id}</div>
        </FacingHtml>
      )}
    </group>
  );
}

function GroundPin({
  id,
  kind,
  label,
  detail,
  positions,
  showLabel = true,
}: {
  id: string;
  kind: "gateway" | "client";
  label: string;
  detail?: string;
  positions: MutableRefObject<PosMap>;
  showLabel?: boolean;
}) {
  const ref = useRef<Group>(null);
  const color = kind === "gateway" ? GATEWAY : CLIENT;
  const size = kind === "gateway" ? 0.016 : 0.011;
  const text = detail ? `${label} · ${detail}` : label;
  useFrame(() => {
    const p = positions.current.get(id);
    if (!p || !ref.current) return;
    _n.copy(p).normalize();
    ref.current.position.copy(p).addScaledVector(_n, 0.012);
    ref.current.quaternion.setFromUnitVectors(UP, _n);
  });
  return (
    <group ref={ref}>
      <mesh>
        <coneGeometry args={[size * 0.42, size * 1.55, kind === "gateway" ? 4 : 3]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Billboard follow>
        <mesh>
          <ringGeometry args={[size * 0.7, size * 0.95, 12]} />
          <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={0.9} />
        </mesh>
      </Billboard>
      {showLabel && (
        <FacingHtml position={[0, size * 1.4, 0]}>
          <div className={`globe-label globe-label-${kind}`}>{text}</div>
        </FacingHtml>
      )}
    </group>
  );
}

function Nadir({ id, positions }: { id: string; positions: MutableRefObject<PosMap> }) {
  const lineRef = useRef<Line2>(null);
  const markRef = useRef<Group>(null);
  const crossRef = useRef<Group>(null);
  useFrame(() => {
    const p = positions.current.get(id);
    if (!p) return;
    _a.copy(p);
    const len = _a.length();
    _b.copy(_a).multiplyScalar(1.002 / Math.max(len, 1e-6));
    if (lineRef.current?.geometry) {
      lineRef.current.geometry.setPositions([_a.x, _a.y, _a.z, _b.x, _b.y, _b.z]);
    }
    if (crossRef.current) crossRef.current.position.copy(_a);
    if (markRef.current) {
      markRef.current.position.copy(_b);
      markRef.current.quaternion.setFromUnitVectors(UP, _n.copy(_b).normalize());
    }
  });
  return (
    <group>
      <Line
        ref={lineRef}
        points={[[0, 0, 0], [0, 0.01, 0]]}
        color={NADIR}
        lineWidth={1.15}
        transparent
        opacity={0.92}
        depthWrite={false}
      />
      <group ref={crossRef}>
        <Billboard follow>
          <mesh>
            <boxGeometry args={[0.028, 0.0022, 0.001]} />
            <meshBasicMaterial color={NADIR} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.0022, 0.028, 0.001]} />
            <meshBasicMaterial color={NADIR} />
          </mesh>
        </Billboard>
      </group>
      <group ref={markRef}>
        <mesh>
          <sphereGeometry args={[0.0045, 10, 10]} />
          <meshBasicMaterial color={NADIR} />
        </mesh>
        <Billboard follow>
          <mesh>
            <ringGeometry args={[0.009, 0.013, 20]} />
            <meshBasicMaterial color={NADIR} side={DoubleSide} transparent opacity={0.85} />
          </mesh>
        </Billboard>
      </group>
    </group>
  );
}

export default function Network({
  snapshot,
  routePath,
  connected,
  followedId,
  lite = false,
  onSatPick,
}: {
  snapshot: Snapshot;
  routePath: string[];
  connected: boolean;
  followedId: string | null;
  lite?: boolean;
  onSatPick: (id: string) => void;
}) {
  const positions = useSmoothedPositions(snapshot);
  const satIds = useMemo(() => new Set(snapshot.satellites.map((s) => s.id)), [snapshot.satellites]);
  const routeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 0; i < routePath.length - 1; i += 1) {
      keys.add(`${routePath[i]}|${routePath[i + 1]}`);
      keys.add(`${routePath[i + 1]}|${routePath[i]}`);
    }
    return keys;
  }, [routePath]);

  const isl = useMemo(() => {
    const out: [string, string][] = [];
    for (const [a, b] of snapshot.edges) {
      if (!satIds.has(a) || !satIds.has(b)) continue;
      if (routeKeys.has(`${a}|${b}`)) continue;
      out.push([a, b]);
      if (lite && out.length >= 48) break;
    }
    return out;
  }, [snapshot.edges, satIds, routeKeys, lite]);

  const pathAnchorId = routePath[Math.floor(routePath.length / 2)] ?? null;
  const labeled = new Set(routePath);

  return (
    <group>
      {isl.map(([a, b]) => {
        const hot = followedId === a || followedId === b;
        return (
          <MovingLine
            key={`${a}-${b}`}
            a={a}
            b={b}
            positions={positions}
            color={hot ? ISL_HOT : ISL}
            lineWidth={hot ? 1.05 : 0.55}
            opacity={hot ? 0.78 : 0.22}
            throttle
          />
        );
      })}
      {routePath.slice(0, -1).map((id, i) => (
        <MovingLine
          key={`rt-${id}-${routePath[i + 1]}`}
          a={id}
          b={routePath[i + 1]}
          positions={positions}
          color={ROUTE}
          lineWidth={1.35}
          opacity={0.96}
          lift={0.012}
        />
      ))}
      {snapshot.satellites.map((sat) => (
        <SatDot
          key={sat.id}
          id={sat.id}
          active={sat.active}
          followed={sat.id === followedId}
          onRoute={routePath.includes(sat.id)}
          positions={positions}
          onPick={onSatPick}
          showLabel={!lite || sat.id === followedId}
        />
      ))}
      {followedId && <Nadir id={followedId} positions={positions} />}
      {snapshot.ground.map((g) => {
        const onRoute = labeled.has(g.id);
        const isGw = g.role === "gateway";
        const detail =
          g.role === "client" && onRoute
            ? connected
              ? "связь есть"
              : "нет маршрута"
            : undefined;
        return (
          <GroundPin
            key={g.id}
            id={g.id}
            kind={isGw ? "gateway" : "client"}
            label={g.id}
            detail={lite ? undefined : detail}
            positions={positions}
            showLabel={!lite}
          />
        );
      })}
      {!lite && pathAnchorId && routePath.length > 1 && (
        <PathLabel ids={routePath} anchorId={pathAnchorId} positions={positions} />
      )}
      {!lite &&
        GEO_LABELS.map((g) => {
          const p = latLonToThree(g.lat, g.lon, 1.012);
          return (
            <FacingHtml key={g.name} position={p}>
              <div className="globe-label-geo">{g.name}</div>
            </FacingHtml>
          );
        })}
    </group>
  );
}

function PathLabel({
  ids,
  anchorId,
  positions,
}: {
  ids: string[];
  anchorId: string;
  positions: MutableRefObject<PosMap>;
}) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const p = positions.current.get(anchorId);
    if (!p || !ref.current) return;
    _n.copy(p).normalize();
    ref.current.position.copy(p).addScaledVector(_n, 0.05);
  });
  return (
    <group ref={ref}>
      <FacingHtml position={[0, 0, 0]}>
        <div className="globe-label globe-label-path">{ids.join(" → ")}</div>
      </FacingHtml>
    </group>
  );
}
