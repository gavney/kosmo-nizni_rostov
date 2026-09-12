import type { TabId } from "../types";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "project", label: "Проект", icon: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" },
  { id: "orbit", label: "Орбита", icon: "M12 3a9 9 0 1 0 0.01 0zM3 12h18M12 3c2.5 2.8 4 5.8 4 9s-1.5 6.2-4 9c-2.5-2.8-4-5.8-4-9s1.5-6.2 4-9z" },
  { id: "satellites", label: "Спутники", icon: "M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM3 12h4m10 0h4M12 3v4m0 10v4" },
  { id: "ground", label: "Земля", icon: "M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  { id: "compare", label: "Сравнение", icon: "M4 6h7v12H4V6zm9 4h7v8h-7v-8z" },
];

export default function Sidebar({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <aside className="sidebar glass">
      <div className="sidebar-brand">
        <p className="brand">Polar Mesh</p>
        <p className="sub">Северная группировка</p>
      </div>
      <nav className="sidebar-nav">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => onChange(item.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <p className="sidebar-keys">
        ЛКМ — вращать
        <br />
        ПКМ / СКМ — сдвиг
        <br />
        Клик по КА — слежение
        <br />
        Пробел — пуск · Esc — домой
      </p>
    </aside>
  );
}
