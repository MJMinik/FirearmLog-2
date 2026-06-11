export type TabId = 'home' | 'log' | 'compete' | 'progress' | 'more';

const TABS: { id: TabId; label: string; glyph: string }[] = [
  { id: 'home', label: 'Home', glyph: '⌂' },
  { id: 'log', label: 'Log', glyph: '☰' },
  { id: 'compete', label: 'Compete', glyph: '🏆' },
  { id: 'progress', label: 'Progress', glyph: '📈' },
  { id: 'more', label: 'More', glyph: '⋯' }
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={active === t.id ? 'active' : ''}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <span className="glyph" aria-hidden="true">{t.glyph}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
