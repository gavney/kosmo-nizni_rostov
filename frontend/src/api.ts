import type { CompareResult, Scenario, Simulation, Snapshot, VariantInfo } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? body.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
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
  return request<Simulation>("/api/simulate", {
    method: "POST",
    body: JSON.stringify({ scenario, mode }),
  });
}

export function snapshot(
  scenario: Scenario,
  t_s: number,
  opts?: { sim_id?: string; client_id?: string; mode?: string },
) {
  return request<Snapshot>("/api/snapshot", {
    method: "POST",
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
  return request<unknown>("/api/export", {
    method: "POST",
    body: JSON.stringify({ scenario, mode }),
  });
}

export function saveVariant(name: string, scenario: Scenario, mode = "bfs") {
  return request<VariantInfo>("/api/variants", {
    method: "POST",
    body: JSON.stringify({ name, scenario, mode }),
  });
}

export function listVariants() {
  return request<VariantInfo[]>("/api/variants");
}

export function loadVariant(id: string) {
  return request<VariantInfo>(`/api/variants/${id}`);
}

export function compareScenarios(
  left: Scenario,
  right: Scenario,
  left_name: string,
  right_name: string,
  mode = "bfs",
) {
  return request<CompareResult>("/api/compare", {
    method: "POST",
    body: JSON.stringify({ left, right, left_name, right_name, mode }),
  });
}
