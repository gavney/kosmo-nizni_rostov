import type { CompareResult, Scenario, Simulation, Snapshot, VariantInfo } from "./types";

async function request<T>(path: string, init?: RequestInit, retries = 0): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (response.status === 503 && retries > 0) {
    const wait = Number(response.headers.get("Retry-After") ?? "3") * 1000;
    await new Promise((resolve) => window.setTimeout(resolve, Math.min(8000, wait || 3000)));
    return request<T>(path, init, retries - 1);
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? body.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return response.json() as Promise<T>;
}

export function listFixtures() {
  return request<{ id: string; title: string; filename: string }[]>("/api/fixtures");
}

export function getFixture(id: string) {
  return request<Scenario>(`/api/fixtures/${id}`);
}

export function validateScenario(scenario: Scenario) {
  return request<{ ok: boolean; error: string | null; field: string | null }>(
    "/api/scenarios/validate",
    { method: "POST", body: JSON.stringify({ scenario }) },
  );
}

export function simulate(scenario: Scenario, mode = "bfs") {
  return request<Simulation>(
    "/api/simulate",
    {
      method: "POST",
      body: JSON.stringify({ scenario, mode }),
    },
    3,
  );
}

export function snapshot(
  scenario: Scenario,
  t_s: number,
  opts?: { sim_id?: string; client_id?: string; mode?: string; signal?: AbortSignal },
) {
  return request<Snapshot>("/api/snapshot", {
    method: "POST",
    signal: opts?.signal,
    body: JSON.stringify({
      scenario,
      t_s,
      sim_id: opts?.sim_id ?? null,
      client_id: opts?.client_id ?? null,
      mode: opts?.mode ?? "bfs",
    }),
  });
}

export function exportResult(scenario: Scenario, mode = "bfs") {
  return request<unknown>(
    "/api/export",
    {
      method: "POST",
      body: JSON.stringify({ scenario, mode }),
    },
    3,
  );
}

export function saveVariant(name: string, scenario: Scenario, mode = "bfs") {
  return request<VariantInfo>(
    "/api/variants",
    {
      method: "POST",
      body: JSON.stringify({ name, scenario, mode }),
    },
    3,
  );
}

export function listVariants() {
  return request<VariantInfo[]>("/api/variants");
}

export function loadVariant(id: string) {
  return request<VariantInfo>(`/api/variants/${id}`);
}

export function patchLaunchStage(scenario: Scenario, launch_stage: number) {
  return request<Scenario>("/api/scenarios/launch-stage", {
    method: "POST",
    body: JSON.stringify({ scenario, launch_stage }),
  });
}

export function patchPlane(
  scenario: Scenario,
  plane_id: string,
  patch: { raan_deg?: number; phase_deg?: number },
) {
  return request<Scenario>("/api/scenarios/plane", {
    method: "POST",
    body: JSON.stringify({ scenario, plane_id, ...patch }),
  });
}

export function patchFailure(
  scenario: Scenario,
  satellite_id: string,
  start_s: number,
  end_s: number,
  clear = false,
) {
  return request<Scenario>("/api/scenarios/failure", {
    method: "POST",
    body: JSON.stringify({ scenario, satellite_id, start_s, end_s, clear }),
  });
}

export function patchGatewayOutage(
  scenario: Scenario,
  gateway_id: string,
  start_s: number,
  end_s: number,
  clear = false,
) {
  return request<Scenario>("/api/scenarios/gateway-outage", {
    method: "POST",
    body: JSON.stringify({ scenario, gateway_id, start_s, end_s, clear }),
  });
}

export function compareScenarios(
  left: Scenario,
  right: Scenario,
  left_name: string,
  right_name: string,
  mode = "bfs",
) {
  return request<CompareResult>(
    "/api/compare",
    {
      method: "POST",
      body: JSON.stringify({ left, right, left_name, right_name, mode }),
    },
    3,
  );
}
