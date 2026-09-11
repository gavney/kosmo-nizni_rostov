import { formatClock, downsample } from "../format";
import type { Series } from "../types";

export default function Timeline({
  times,
  index,
  playing,
  series,
  onChange,
  onToggle,
}: {
  times: number[];
  index: number;
  playing: boolean;
  series: Series | undefined;
  onChange: (index: number) => void;
  onToggle: () => void;
}) {
  const t = times[index] ?? 0;
  const reachable = series?.reachable[index];
  const flags = downsample(series?.reachable ?? [], 180);

  return (
    <div className="timeline">
      <button type="button" className="play" onClick={onToggle}>
        {playing ? "Пауза" : "Пуск"}
      </button>
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
      <div className="clock">
        <strong>{formatClock(t)}</strong>
        <span>{reachable ? "связь есть" : "перерыв"}</span>
      </div>
    </div>
  );
}
