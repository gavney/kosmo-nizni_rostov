import type { Scenario } from "./types";

export const R_KM = 6371;

export function ecefToThree(x: number, y: number, z: number, scale = 1 / R_KM): [number, number, number] {
  return [x * scale, z * scale, -y * scale];
}

export function formatClock(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function minutes(seconds: number): string {
  if (seconds < 60) return `${seconds} с`;
  return `${Math.round(seconds / 60)} мин`;
}

export function reasonLabel(reason: string | null): string {
  switch (reason) {
    case "no_visible_satellite":
      return "Нет видимого спутника";
    case "isl_disconnected":
      return "Разрыв межспутниковой сети";
    case "no_gateway_contact":
      return "Нет контакта со шлюзом";
    case "gateway_offline":
      return "Шлюз недоступен";
    default:
      return "Маршрут есть";
  }
}

export function cloneScenario(scenario: Scenario): Scenario {
  return structuredClone(scenario);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downsample<T>(items: T[], max = 240): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) out.push(items[Math.floor(i * step)]);
  return out;
}
