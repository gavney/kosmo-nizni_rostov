import type { TabId } from "../types";

const TABS: { id: TabId; label: string }[] = [
  { id: "project", label: "Project" },
  { id: "orbit", label: "Orbit" },
  { id: "satellites", label: "Satellite" },
  { id: "ground", label: "Ground" },
  { id: "compare", label: "Compare" },
];

export default function BottomNav({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav className="bottom-nav">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={tab === item.id ? "active" : ""}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
