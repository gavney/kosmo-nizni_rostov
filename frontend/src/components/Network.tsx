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
const SAT = "#9ec8dc";
const SAT_ROUTE = "#ffd45a";
const SAT_FOLLOW = "#7dffb2";
const GATEWAY = "#f0b24a";
const CLIENT = "#6fdb9a";
const ISL = "#3aa8b8";
const ISL_HOT = "#6eefe0";
const ROUTE = "#fff1b0";
const ROUTE_GOLD = "#ffd56a";
const ROUTE_BACKUP = "#b8c4d4";
export type DisplayRoute = {
  clientId: string;
  path: string[];
  color: string;
  backupPath?: string[];
  hasBackup?: boolean;
  spof?: string[];
};
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

/** Dirty smooth: chase target every frame. Longer tau while playing ≈ tick gap. */
function useSmoothedPositions(snapshot: Snapshot, blendSec: number): MutableRefObject<PosMap> {
  const current = useRef<PosMap>(new Map());
  const to = useRef<PosMap>(new Map());
  const tauRef = useRef(blendSec);

  useEffect(() => {
    tauRef.current = Math.max(0.12, blendSec);
  }, [blendSec]);

  useEffect(() => {
    fillTargets(snapshot, to.current);
    if (current.current.size === 0) {
      copyInto(current.current, to.current);
    }
  }, [snapshot]);

  useFrame((_, dt) => {
    const tau = tauRef.current;
    const k = 1 - Math.exp(-Math.min(dt, 0.08) / tau);
    for (const [id, tgt] of to.current) {
      let cur = current.current.get(id);
      if (!cur) {
        cur = tgt.clone();
        current.current.set(id, cur);
        continue;
      }
      cur.lerp(tgt, k);
    }
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
  dashed = false,
}: {
  a: string;
  b: string;
  positions: MutableRefObject<PosMap>;
  color: string;
  lineWidth: number;
  opacity: number;
  lift?: number;
  throttle?: boolean;
  dashed?: boolean;
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
    if (dashed) line.computeLineDistances();
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
      dashed={dashed}
      dashSize={dashed ? 0.04 : undefined}
      gapSize={dashed ? 0.028 : undefined}
      dashScale={dashed ? 1 : undefined}
    />
  );
}

function SatDot({
  id,
  active,
  followed,
  onRoute,
  critical,
  routeColor,
  positions,
  onPick,
  showLabel = true,
}: {
  id: string;
  active: boolean;
  followed: boolean;
  onRoute: boolean;
  critical?: boolean;
  routeColor?: string;
  positions: MutableRefObject<PosMap>;
  onPick: (id: string) => void;
  showLabel?: boolean;
}) {
  const ref = useRef<Group>(null);
  // Bigger + brighter so night side still reads.
  const size = followed ? 0.011 : onRoute ? 0.009 : critical ? 0.0075 : active ? 0.0065 : 0.0048;
  const color = followed
    ? SAT_FOLLOW
    : onRoute
      ? routeColor || SAT_ROUTE
      : critical
        ? "#ff6b4a"
        : active
          ? SAT
          : "#5a6a75";
  const opacity = followed || onRoute || critical ? 1 : active ? 0.92 : 0.55;
  useFrame(() => {
    const p = positions.current.get(id);
    if (p && ref.current) ref.current.position.copy(p);
  });
  return (
    <group ref={ref}>
      {(followed || onRoute || critical) && (
        <Billboard follow>
          <mesh>
            <ringGeometry args={[size * 1.35, size * 1.85, 16]} />
            <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={0.85} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
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
        <sphereGeometry args={[size, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
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
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshBasicMaterial />
      </mesh>
      {showLabel && (
        <FacingHtml position={[0, 0.02, 0]}>
          <div
            className={`globe-label ${
              followed
                ? "globe-label-follow"
                : onRoute
                  ? "globe-label-sat"
                  : critical
                    ? "globe-label-critical"
                    : "globe-label-idle"
            }`}
          >
            {id}
          </div>
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
  accent,
  positions,
  showLabel = true,
}: {
  id: string;
  kind: "gateway" | "client";
  label: string;
  detail?: string;
  accent?: string;
  positions: MutableRefObject<PosMap>;
  showLabel?: boolean;
}) {
  const ref = useRef<Group>(null);
  const color = accent ?? (kind === "gateway" ? GATEWAY : CLIENT);
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

function CoverageHalo({
  id,
  color,
  connected,
  positions,
}: {
  id: string;
  color: string;
  connected: boolean;
  positions: MutableRefObject<PosMap>;
}) {
  const ref = useRef<Group>(null);
  const inner = connected ? 0.028 : 0.02;
  const outer = connected ? 0.055 : 0.038;
  useFrame(() => {
    const p = positions.current.get(id);
    if (!p || !ref.current) return;
    _n.copy(p).normalize();
    ref.current.position.copy(p).addScaledVector(_n, 0.004);
    ref.current.quaternion.setFromUnitVectors(UP, _n);
  });
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[inner, outer, 48]} />
        <meshBasicMaterial
          color={color}
          side={DoubleSide}
          transparent
          opacity={connected ? 0.38 : 0.16}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[inner * 0.85, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={connected ? 0.12 : 0.04}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function OrbitTracks({
  snapshot,
  planeOf,
  positions,
}: {
  snapshot: Snapshot;
  planeOf: Record<string, string>;
  positions: MutableRefObject<PosMap>;
}) {
  const loops = useMemo(() => {
    const byPlane = new Map<string, string[]>();
    for (const sat of snapshot.satellites) {
      if (!sat.active) continue;
      const plane = planeOf[sat.id];
      if (!plane) continue;
      const list = byPlane.get(plane) ?? [];
      list.push(sat.id);
      byPlane.set(plane, list);
    }
    const out: { plane: string; ids: string[] }[] = [];
    for (const [plane, ids] of byPlane) {
      if (ids.length < 4) continue;
      // Sort around approximate plane axis from first three positions.
      const a = ecefToThree(
        snapshot.satellites.find((s) => s.id === ids[0])!.x_km,
        snapshot.satellites.find((s) => s.id === ids[0])!.y_km,
        snapshot.satellites.find((s) => s.id === ids[0])!.z_km,
      );
      const b = ecefToThree(
        snapshot.satellites.find((s) => s.id === ids[1])!.x_km,
        snapshot.satellites.find((s) => s.id === ids[1])!.y_km,
        snapshot.satellites.find((s) => s.id === ids[1])!.z_km,
      );
      const c = ecefToThree(
        snapshot.satellites.find((s) => s.id === ids[2])!.x_km,
        snapshot.satellites.find((s) => s.id === ids[2])!.y_km,
        snapshot.satellites.find((s) => s.id === ids[2])!.z_km,
      );
      const va = new Vector3(...a);
      const vb = new Vector3(...b);
      const vc = new Vector3(...c);
      const normal = new Vector3().crossVectors(vb.clone().sub(va), vc.clone().sub(va)).normalize();
      if (normal.lengthSq() < 1e-8) continue;
      const tangent = new Vector3().crossVectors(normal, va).normalize();
      const bitangent = new Vector3().crossVectors(normal, tangent).normalize();
      const ranked = ids
        .map((id) => {
          const sat = snapshot.satellites.find((s) => s.id === id)!;
          const p = new Vector3(...ecefToThree(sat.x_km, sat.y_km, sat.z_km));
          const angle = Math.atan2(p.dot(bitangent), p.dot(tangent));
          return { id, angle };
        })
        .sort((x, y) => x.angle - y.angle)
        .map((x) => x.id);
      out.push({ plane, ids: ranked });
    }
    return out;
  }, [snapshot, planeOf]);

  return (
    <group>
      {loops.map(({ plane, ids }) => (
        <OrbitLoop key={plane} ids={ids} positions={positions} />
      ))}
    </group>
  );
}

function OrbitLoop({
  ids,
  positions,
}: {
  ids: string[];
  positions: MutableRefObject<PosMap>;
}) {
  const ref = useRef<Line2>(null);
  useFrame(() => {
    if (!ref.current?.geometry) return;
    const pts: number[] = [];
    for (const id of ids) {
      const p = positions.current.get(id);
      if (!p) return;
      pts.push(p.x, p.y, p.z);
    }
    const first = positions.current.get(ids[0]);
    if (first) pts.push(first.x, first.y, first.z);
    ref.current.geometry.setPositions(pts);
  });
  return (
    <Line
      ref={ref}
      points={ids.map(() => [0, 0, 0] as [number, number, number])}
      color="#3d5a6c"
      lineWidth={0.55}
      transparent
      opacity={0.28}
      depthWrite={false}
    />
  );
}

export default function Network({
  snapshot,
  routes,
  followedId,
  criticalIds = [],
  planeOf = {},
  showIsl = true,
  showOrbits = true,
  showCoverage = true,
  showCritical = true,
  showLabels = true,
  showBackup = false,
  lite = false,
  blendSec = 0.28,
  onSatPick,
}: {
  snapshot: Snapshot;
  routes: DisplayRoute[];
  followedId: string | null;
  criticalIds?: string[];
  planeOf?: Record<string, string>;
  showIsl?: boolean;
  showOrbits?: boolean;
  showCoverage?: boolean;
  showCritical?: boolean;
  showLabels?: boolean;
  showBackup?: boolean;
  lite?: boolean;
  blendSec?: number;
  onSatPick: (id: string) => void;
}) {
  const positions = useSmoothedPositions(snapshot, blendSec);
  const satIds = useMemo(() => new Set(snapshot.satellites.map((s) => s.id)), [snapshot.satellites]);
  const critical = useMemo(
    () => new Set(showCritical ? criticalIds : []),
    [criticalIds, showCritical],
  );
  const routeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const route of routes) {
      for (let i = 0; i < route.path.length - 1; i += 1) {
        keys.add(`${route.path[i]}|${route.path[i + 1]}`);
        keys.add(`${route.path[i + 1]}|${route.path[i]}`);
      }
    }
    return keys;
  }, [routes]);

  const satRouteColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const route of routes) {
      for (const id of route.path) {
        if (!map.has(id)) map.set(id, showBackup ? ROUTE_GOLD : route.color);
      }
      if (showBackup) {
        for (const id of route.backupPath ?? []) {
          if (!map.has(id)) map.set(id, ROUTE_BACKUP);
        }
      }
    }
    return map;
  }, [routes, showBackup]);

  const isl = useMemo(() => {
    if (!showIsl) return [] as [string, string][];
    const out: [string, string][] = [];
    for (const [a, b] of snapshot.edges) {
      if (!satIds.has(a) || !satIds.has(b)) continue;
      if (routeKeys.has(`${a}|${b}`)) continue;
      out.push([a, b]);
      if (lite && out.length >= 24) break;
    }
    return out;
  }, [snapshot.edges, satIds, routeKeys, lite, showIsl]);

  const clientRouteById = useMemo(() => {
    const map = new Map<string, DisplayRoute>();
    for (const route of routes) map.set(route.clientId, route);
    return map;
  }, [routes]);

  return (
    <group>
      {showOrbits && !lite && Object.keys(planeOf).length > 0 && (
        <OrbitTracks snapshot={snapshot} planeOf={planeOf} positions={positions} />
      )}
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
      {routes.map((route, ri) =>
        route.path.slice(0, -1).map((id, i) => (
          <MovingLine
            key={`rt-${route.clientId}-${id}-${route.path[i + 1]}`}
            a={id}
            b={route.path[i + 1]}
            positions={positions}
            color={showBackup ? ROUTE_GOLD : route.color || ROUTE}
            lineWidth={showBackup ? 1.55 : 1.35}
            opacity={0.96}
            lift={0.01 + ri * 0.004}
          />
        )),
      )}
      {showBackup &&
        routes.map((route, ri) => {
          const backup = route.backupPath ?? [];
          if (backup.length < 2) return null;
          return backup.slice(0, -1).map((id, i) => (
            <MovingLine
              key={`bk-${route.clientId}-${id}-${backup[i + 1]}`}
              a={id}
              b={backup[i + 1]}
              positions={positions}
              color={ROUTE_BACKUP}
              lineWidth={1.15}
              opacity={0.85}
              lift={0.018 + ri * 0.004}
              dashed
            />
          ));
        })}
      {showCoverage &&
        routes.map((route) => (
          <CoverageHalo
            key={`halo-${route.clientId}`}
            id={route.clientId}
            color={route.color}
            connected={route.path.length > 0}
            positions={positions}
          />
        ))}
      {snapshot.satellites.map((sat) => (
        <SatDot
          key={sat.id}
          id={sat.id}
          active={sat.active}
          followed={sat.id === followedId}
          onRoute={satRouteColor.has(sat.id)}
          critical={critical.has(sat.id) && !satRouteColor.has(sat.id)}
          routeColor={satRouteColor.get(sat.id)}
          positions={positions}
          onPick={onSatPick}
          showLabel={showLabels}
        />
      ))}
      {followedId && <Nadir id={followedId} positions={positions} />}
      {snapshot.ground.map((g) => {
        const clientRoute = clientRouteById.get(g.id);
        const onRoute = Boolean(clientRoute) || satRouteColor.has(g.id);
        const isGw = g.role === "gateway";
        const detail =
          g.role === "client" && clientRoute
            ? clientRoute.path.length
              ? "связь есть"
              : "нет маршрута"
            : undefined;
        return (
          <GroundPin
            key={g.id}
            id={g.id}
            kind={isGw ? "gateway" : "client"}
            label={g.id}
            detail={detail}
            accent={clientRoute?.color}
            positions={positions}
            showLabel={showLabels && (onRoute || g.role === "gateway" || g.role === "client")}
          />
        );
      })}
      {showLabels &&
        routes.map((route) => {
          if (route.path.length < 2) return null;
          const anchorId = route.path[Math.floor(route.path.length / 2)] ?? null;
          if (!anchorId) return null;
          return (
            <PathLabel
              key={`lbl-${route.clientId}`}
              ids={route.path}
              anchorId={anchorId}
              color={route.color}
              positions={positions}
            />
          );
        })}
      {showLabels &&
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
  color,
  positions,
}: {
  ids: string[];
  anchorId: string;
  color?: string;
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
        <div className="globe-label globe-label-path" style={color ? { color, borderColor: color } : undefined}>
          {ids.join(" → ")}
        </div>
      </FacingHtml>
    </group>
  );
}
