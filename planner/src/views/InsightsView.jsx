import { CATEGORIES } from '../data/categories';

export default function InsightsView({ habits, habitHistory, todos, groups, weeklyHabits }) {
  const stats = {};
  habits.filter((h) => h.cadence !== 'week').forEach((h) => { stats[h.name] = { completed: 0, total: 0 }; });
  habitHistory.forEach((entry) => {
    (entry.snapshot || []).forEach((item) => {
      if (!stats[item.name]) stats[item.name] = { completed: 0, total: 0 };
      stats[item.name].total += 1;
      if (item.completed) stats[item.name].completed += 1;
    });
  });

  // Match each tracked habit name to its current group — checking today's
  // live habit list first, then falling back to the day-specific habit's
  // remembered group for names that aren't injected today.
  function groupIdFor(name) {
    const live = habits.find((h) => h.name === name);
    if (live) return live.groupId || null;
    const weekly = weeklyHabits.find((w) => w.name === name);
    if (weekly) return weekly.groupId || null;
    return null;
  }

  const names = Object.keys(stats);
  const byGroup = {};
  const ungrouped = [];
  names.forEach((n) => {
    const gid = groupIdFor(n);
    if (gid) {
      if (!byGroup[gid]) byGroup[gid] = [];
      byGroup[gid].push(n);
    } else {
      ungrouped.push(n);
    }
  });

  function renderRows(list) {
    return (
      <div className="history-grid" style={{ marginTop: 10 }}>
        {list.map((n) => {
          const s = stats[n];
          const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
          return (
            <div className="history-row" key={n}>
              <div className="history-label-row">
                <span>{n}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
              </div>
              <div className="history-bar-bg">
                <div className="history-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const completedTodos = todos.filter((t) => t.completed);
  const catCounts = { work: 0, admin: 0, errands: 0, chores: 0, personal: 0 };
  completedTodos.forEach((t) => { if (catCounts[t.category] !== undefined) catCounts[t.category]++; });
  const total = completedTodos.length || 1;
  const maxCat = Object.keys(catCounts).reduce((a, b) => (catCounts[a] > catCounts[b] ? a : b));

  return (
    <div className="view">
      <div className="section-row">
        <h2 className="section-title">Insights</h2>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -8, marginBottom: 20 }}>
        A look back at your patterns — check in whenever you want, no pressure to watch it daily.
      </p>

      <div className="history-box" style={{ marginBottom: '1.5rem' }}>
        <div className="eyebrow" style={{ marginBottom: 0 }}>Habit consistency</div>
        {habitHistory.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
            Click "Begin a new day" on the Today tab to start tracking your consistency over time.
          </p>
        ) : (
          <>
            {groups.map((g) => {
              const list = byGroup[g.id];
              if (!list || list.length === 0) return null;
              return (
                <div key={g.id}>
                  <div className="history-subhead">{g.name}</div>
                  {renderRows(list)}
                </div>
              );
            })}
            {ungrouped.length > 0 && (
              <div>
                {groups.length > 0 && <div className="history-subhead">Ungrouped</div>}
                {renderRows(ungrouped)}
              </div>
            )}
          </>
        )}
      </div>

      <div className="balance-box">
        <h4>Completed task balance</h4>
        <div className="balance-bar">
          {Object.keys(catCounts).map((cat) => (
            <div key={cat} style={{ width: `${(catCounts[cat] / total) * 100}%`, background: CATEGORIES[cat].color }} title={CATEGORIES[cat].label} />
          ))}
        </div>
        <p className="balance-warning">
          {completedTodos.length === 0
            ? 'Complete tasks to see your category balance.'
            : catCounts[maxCat] / total > 0.5
            ? `Completed tasks lean heavily toward ${CATEGORIES[maxCat].label.toLowerCase()}. Worth shifting focus.`
            : 'Completed tasks are fairly balanced across categories.'}
        </p>
      </div>
    </div>
  );
}
