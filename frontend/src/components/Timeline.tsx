import { formatClock, downsample } from "../format";
import type { Series } from "../types";

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export default function Timeline({
  times,
  index,
  playing,
  speed,
  series,
  onChange,
  onToggle,
  onSpeed,
  onStep,
}: {
  times: number[];
  index: number;
  playing: boolean;
  speed: number;
  series: Series | undefined;
  onChange: (index: number) => void;
  onToggle: () => void;
  onSpeed: (speed: number) => void;
  onStep: (delta: number) => void;
}) {
  const t = times[index] ?? 0;
  const reachable = series?.reachable[index];
  const flags = downsample(series?.reachable ?? [], 180);

  return (
    <div className="timeline glass">
      <div className="transport">
        <button type="button" className="icon-btn" onClick={() => onStep(-1)} aria-label="Шаг назад">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 12 19 6v12L11 12zm-7 6V6h2.2v12H4z" fill="currentColor" />
          </svg>
        </button>
        <button type="button" className="play" onClick={onToggle} aria-label={playing ? "Пауза" : "Пуск"}>
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
              <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button type="button" className="icon-btn" onClick={() => onStep(1)} aria-label="Шаг вперёд">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13 12 5 6v12l8-6zm7-6v12h-2.2V6H20z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div className="timeline-body">
        <div className="spark">
          {flags.map((ok, i) => (
            <span
              key={i}
              className={ok ? "on" : "off"}
              style={{ width: `${100 / Math.max(flags.length, 1)}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(times.length - 1, 0)}
          value={index}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <label className="speed">
        <span>Скорость</span>
        <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
          {PLAYBACK_SPEEDS.map((value) => (
            <option key={value} value={value}>
              {value}×
            </option>
          ))}
        </select>
      </label>
      <div className="clock">
        <strong>{formatClock(t)}</strong>
        <span>{reachable ? "Связь есть" : "Перерыв"}</span>
      </div>
    </div>
  );
}
