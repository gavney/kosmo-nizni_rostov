import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ComparePanel from "./components/ComparePanel";
import Globe from "./components/Globe";
import GroundPanel from "./components/GroundPanel";
import { MetricsList, clientRouteColor } from "./components/Metrics";
import ProjectPanel from "./components/ProjectPanel";
import SatellitesPanel from "./components/SatellitesPanel";
import Timeline, { PLAYBACK_SPEEDS } from "./components/Timeline";
import {
  compareScenarios,
  exportResult,
  getFixture,
  listFixtures,
  listVariants,
  loadVariant,
  patchFailure,
  patchGatewayOutage,
  patchLaunchStage,
  saveVariant,
  simulate as runSimulate,
  snapshot as fetchSnapshot,
  validateScenario,
} from "./api";
import { cloneScenario, downloadJson, formatClock, pct, reasonLabel } from "./format";
import type {
  CompareResult,
  RouteInfo,
  Scenario,
  Simulation,
  Snapshot,
  TabId,
  VariantInfo,
} from "./types";

function tabLabel(tab: TabId): string {
  switch (tab) {
    case "project":
      return "Проект";
    case "orbit":
      return "Орбита";
    case "satellites":
      return "Спутники";
    case "ground":
      return "Земля";
    case "compare":
      return "Сравнение";
  }
}

export default function App() {
  const [fixtures, setFixtures] = useState<{ id: string; title: string }[]>([]);
  const [baseline, setBaseline] = useState<Scenario | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [sim, setSim] = useState<Simulation | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<TabId>("orbit");
  const [clientId, setClientId] = useState("C65");
  const [showAllClients, setShowAllClients] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"bfs" | "dijkstra">("bfs");
  const [selectedSat, setSelectedSat] = useState<string | null>("S01");
  const [followedSat, setFollowedSat] = useState<string | null>(null);
  const [failStart, setFailStart] = useState(21600);
  const [failEnd, setFailEnd] = useState(86400);
  const [variants, setVariants] = useState<VariantInfo[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const debounce = useRef<number | null>(null);
  const t = sim?.times[index] ?? 0;
  const clientIds = useMemo(
    () => (sim ? Object.keys(sim.metrics.clients) : scenario?.ground_sites.filter((g) => g.role === "client").map((g) => g.id) ?? []),
    [sim, scenario],
  );
  const displayRoutes = useMemo(() => {
    if (!snap) return [];
    const source = showAllClients
      ? snap.routes
      : snap.routes.filter((r) => r.client_id === clientId);
    return source.map((r) => ({
      clientId: r.client_id,
      path: r.path,
      color: clientRouteColor(r.client_id, clientIds),
    }));
  }, [snap, showAllClients, clientId, clientIds]);
  const route: RouteInfo | undefined = snap?.routes.find((r) => r.client_id === clientId);
  const primaryRoute = showAllClients
    ? snap?.routes.find((r) => r.path.length) ?? route
    : route;

  const pickSatellite = (id: string) => {
    setSelectedSat(id);
    setFollowedSat((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (event.key === "Escape") {
        setFollowedSat(null);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setIndex((value) => Math.max(0, value - 1));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((value) => {
          if (!sim) return value;
          return (value + 1) % sim.times.length;
        });
        return;
      }
      if (event.key === "[" || event.key === ",") {
        setSpeed((value) => PLAYBACK_SPEEDS[Math.max(0, PLAYBACK_SPEEDS.indexOf(value) - 1)] ?? value);
      }
      if (event.key === "]" || event.key === ".") {
        setSpeed((value) => PLAYBACK_SPEEDS[Math.min(PLAYBACK_SPEEDS.length - 1, PLAYBACK_SPEEDS.indexOf(value) + 1)] ?? value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim]);

  const loadSim = useCallback(async (next: Scenario, nextMode = mode) => {
    setBusy(true);
    setError(null);
    try {
      const check = await validateScenario(next);
      if (!check.ok) throw new Error(check.error ?? "Некорректный сценарий");
      const result = await runSimulate(next, nextMode);
      setScenario(next);
      setSim(result);
      const night = result.times.findIndex((time) => time >= 28800);
      const idx = night >= 0 ? night : 0;
      setIndex(idx);
      const shot = await fetchSnapshot(next, result.times[idx] ?? 0, {
        sim_id: result.sim_id,
        mode: nextMode,
      });
      setSnap(shot);
      const firstClient = next.ground_sites.find((g) => g.role === "client");
      if (firstClient) setClientId(firstClient.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка расчёта");
    } finally {
      setBusy(false);
    }
  }, [mode]);

  useEffect(() => {
    let ignore = false;
    listFixtures()
      .then(async (items) => {
        if (ignore) return;
        setFixtures(items);
        const first = items[0]?.id ?? "01_full_constellation";
        const data = await getFixture(first);
        if (ignore) return;
        setBaseline(cloneScenario(data));
        await loadSim(data);
        setVariants(await listVariants());
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
    // Boot once on mount; later edits go through loadSim directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scenario || !sim) return;
    const ac = new AbortController();
    fetchSnapshot(scenario, t, {
      sim_id: sim.sim_id,
      mode,
      signal: ac.signal,
    }).then(
      (shot) => setSnap(shot),
      (err) => {
        if (ac.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => ac.abort();
  }, [scenario, sim, t, mode]);

  useEffect(() => {
    if (!playing || !sim) return;
    // Slower scrub on weak VPS — each tick hits /snapshot.
    const interval = Math.max(140, Math.round(240 / speed));
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % sim.times.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [playing, sim, speed]);

  const queueScenario = (next: Scenario) => {
    setScenario(next);
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      void loadSim(next);
    }, 700);
  };

  const onUpload = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Scenario;
      setBaseline(cloneScenario(parsed));
      await loadSim(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать файл");
    }
  };

  const onLoadFixture = async (id: string) => {
    const data = await getFixture(id);
    setBaseline(cloneScenario(data));
    await loadSim(data);
  };

  const save = async () => {
    if (!scenario) return;
    const name = `${scenario.meta.title} / очередь ${scenario.design.launch_stage}`;
    const item = await saveVariant(name, scenario, mode);
    setVariants(await listVariants());
    if (!leftId) setLeftId(item.id);
    else setRightId(item.id);
  };

  const doExport = async () => {
    if (!scenario) return;
    const data = await exportResult(scenario, mode);
    downloadJson(`${scenario.meta.id}-result.json`, data);
    downloadJson(`${scenario.meta.id}-scenario.json`, scenario);
  };

  const runCompare = async () => {
    const left = variants.find((v) => v.id === leftId);
    const right = variants.find((v) => v.id === rightId);
    if (!left || !right) return;
    setBusy(true);
    try {
      const fullLeft = await loadVariant(leftId);
      const fullRight = await loadVariant(rightId);
      if (!fullLeft.scenario || !fullRight.scenario) throw new Error("Нет сценария в варианте");
      setCompare(
        await compareScenarios(
          fullLeft.scenario,
          fullRight.scenario,
          fullLeft.name,
          fullRight.name,
          mode,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сравнение не удалось");
    } finally {
      setBusy(false);
    }
  };

  const delay = primaryRoute?.delay_ms;
  const activeCount = useMemo(
    () => snap?.satellites.filter((s) => s.active).length ?? 0,
    [snap],
  );
  const offlineClients = useMemo(() => {
    if (!showAllClients) return route?.path.length ? [] : [clientId];
    return displayRoutes.filter((r) => !r.path.length).map((r) => r.clientId);
  }, [showAllClients, route, clientId, displayRoutes]);
  const routePathUnion = useMemo(
    () => displayRoutes.flatMap((r) => r.path),
    [displayRoutes],
  );

  if (!scenario) {
    return (
      <main className="boot">
        <div className="boot-card glass">
          <p className="brand">Polar Mesh</p>
          <p className="sub">{error ?? "Считаем орбиты…"}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      <Globe
        snapshot={snap}
        routes={displayRoutes}
        followedId={followedSat}
        playing={playing}
        blendSec={playing ? Math.max(0.18, Math.round(240 / speed) / 1000) : 0.18}
        onSatPick={pickSatellite}
      />
      {offlineClients.length > 0 && (
        <aside className="comm-alarm" role="status">
          <span className="comm-alarm-bang">!</span>
          <div>
            <p className="comm-alarm-title">НЕТ СВЯЗИ</p>
            <p className="comm-alarm-body">
              {offlineClients.join(", ")}: маршрут до шлюза отсутствует
              {!showAllClients && route?.reason ? ` · ${reasonLabel(route.reason)}` : ""}
            </p>
          </div>
        </aside>
      )}
      <Sidebar tab={tab} onChange={setTab} />
      <header className="toolbar glass">
        <div className="toolbar-title">
          <p className="brand">{scenario.meta.title}</p>
          <p className="sub">Инспектор · {tabLabel(tab)}</p>
        </div>
        <div className="status">
          <span className="stat-pill">{activeCount} КА</span>
          <span className="stat-pill">{formatClock(t)}</span>
          <span className="stat-pill">{delay != null ? `${delay.toFixed(1)} мс` : "Нет маршрута"}</span>
          {followedSat ? (
            <button type="button" className="follow-chip" onClick={() => setFollowedSat(null)}>
              Снять слежение · {followedSat} ✕
            </button>
          ) : null}
        </div>
      </header>

      <aside className="panel glass">
        {tab === "project" && (
          <ProjectPanel
            scenario={scenario}
            fixtures={fixtures}
            busy={busy}
            onLoadFixture={(id) => void onLoadFixture(id)}
            onUpload={(file) => void onUpload(file)}
            onStage={(stage) => {
              void patchLaunchStage(scenario, stage).then((next) => loadSim(next));
            }}
            onPlane={(id, key, value) => {
              const next = cloneScenario(scenario);
              const plane = next.design.planes.find((p) => p.id === id);
              if (plane) plane[key] = value;
              queueScenario(next);
            }}
            onSave={() => void save()}
            onExport={() => void doExport()}
            onReset={() => baseline && void loadSim(cloneScenario(baseline))}
          />
        )}
        {tab === "orbit" && sim && (
          <div className="stack">
            <h2>Орбита</h2>
            <p className="lead">Сквозной путь до шлюза на текущем шаге сетки.</p>
            <div className="pills">
              <button type="button" className={mode === "bfs" ? "active" : ""} onClick={() => { setMode("bfs"); void loadSim(scenario, "bfs"); }}>
                Минимум hops
              </button>
              <button type="button" className={mode === "dijkstra" ? "active" : ""} onClick={() => { setMode("dijkstra"); void loadSim(scenario, "dijkstra"); }}>
                Минимум км
              </button>
            </div>
            <MetricsList
              sim={sim}
              clientId={clientId}
              showAll={showAllClients}
              onSelect={(id) => {
                setShowAllClients(false);
                setClientId(id);
              }}
              onSelectAll={() => setShowAllClients(true)}
            />
            <div className="route-box">
              {showAllClients ? (
                displayRoutes.map((r) => (
                  <p key={r.clientId} className="route-colored">
                    <i className="metric-swatch" style={{ background: r.color }} />
                    {r.path.length ? r.path.join(" → ") : `${r.clientId}: ${reasonLabel(snap?.routes.find((x) => x.client_id === r.clientId)?.reason ?? null)}`}
                  </p>
                ))
              ) : (
                <>
                  <p>{route?.path.length ? route.path.join(" → ") : reasonLabel(route?.reason ?? null)}</p>
                  {sim.metrics.clients[clientId] && (
                    <p>
                      цель {pct(sim.metrics.target_availability)} · сейчас{" "}
                      {pct(sim.metrics.clients[clientId].availability)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {tab === "satellites" && (
          <SatellitesPanel
            scenario={scenario}
            snapshot={snap}
            selected={selectedSat}
            followed={followedSat}
            routePath={routePathUnion}
            start={failStart}
            end={failEnd}
            onSelect={setSelectedSat}
            onFollow={setFollowedSat}
            onStart={setFailStart}
            onEnd={setFailEnd}
            onFail={() => {
              if (!selectedSat) return;
              void patchFailure(scenario, selectedSat, failStart, failEnd).then((next) => loadSim(next));
            }}
            onClear={() => {
              if (!selectedSat) return;
              void patchFailure(scenario, selectedSat, failStart, failEnd, true).then((next) => loadSim(next));
            }}
          />
        )}
        {tab === "ground" && (
          <GroundPanel
            scenario={scenario}
            snapshot={snap}
            clientId={clientId}
            route={route}
            start={failStart}
            end={failEnd}
            onClient={setClientId}
            onStart={setFailStart}
            onEnd={setFailEnd}
            onOutage={(gatewayId) => {
              void patchGatewayOutage(scenario, gatewayId, failStart, failEnd).then((next) => loadSim(next));
            }}
            onClear={(gatewayId) => {
              void patchGatewayOutage(scenario, gatewayId, failStart, failEnd, true).then((next) => loadSim(next));
            }}
          />
        )}
        {tab === "compare" && (
          <ComparePanel
            variants={variants}
            leftId={leftId}
            rightId={rightId}
            result={compare}
            busy={busy}
            onLeft={setLeftId}
            onRight={setRightId}
            onRun={() => void runCompare()}
            onLoad={(id) => {
              void loadVariant(id).then((item) => {
                if (item.scenario) {
                  setBaseline(cloneScenario(item.scenario));
                  void loadSim(item.scenario);
                  setTab("orbit");
                }
              });
            }}
          />
        )}
        {error && <p className="error">{error}</p>}
        {busy && <p className="hint toast">Пересчёт сети…</p>}
      </aside>

      {sim && (
        <Timeline
          times={sim.times}
          index={index}
          playing={playing}
          speed={speed}
          series={sim.series[clientId]}
          onChange={setIndex}
          onToggle={() => setPlaying((v) => !v)}
          onSpeed={setSpeed}
          onStep={(delta) => {
            setPlaying(false);
            setIndex((value) => {
              const next = value + delta;
              if (next < 0) return 0;
              return next % sim.times.length;
            });
          }}
        />
      )}
    </div>
  );
}
