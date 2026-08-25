import { useState, useRef, useEffect } from 'react';
import { Check, Square, X, Sparkles, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import DailyNote from '../components/DailyNote';

const WEEKDAYS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
];
const WEEKEND_CHIP = { key: 'weekend', label: 'W' };

function hasWeekend(days) {
  return days.includes('sat') && days.includes('sun');
}
function dayBadges(days) {
  const labels = WEEKDAYS.filter((d) => days.includes(d.key)).map((d) => d.label);
  if (hasWeekend(days)) labels.push('W');
  return labels;
}

function isChoreOverdue(chore) {
  const totalGoalMs = chore.freqVal * (chore.freqUnit === 'weeks' ? 7 : chore.freqUnit === 'months' ? 30 : 1) * 24 * 60 * 60 * 1000;
  return Date.now() - chore.lastDone >= totalGoalMs;
}

function HabitRow({ habit, dragOver, onDragStart, onDragOver, onDragLeave, onDrop, setHabitCount, onEdit, onDelete }) {
  const target = habit.targetCount || 1;
  const count = habit.count || 0;

  return (
    <div
      className={`day-row ${dragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className={`card-label ${habit.completed ? 'completed-text' : ''}`} style={{ flex: 1, minWidth: 0 }}>
        {habit.name}
        {target > 1 && <span className="count-text"> {count}/{target}</span>}
        {habit.cadence === 'week' && <span className="pill pill-muted" style={{ marginLeft: 8 }}>Weekly</span>}
      </span>
      <div className="day-row-actions" draggable={false} onDragStart={(e) => e.stopPropagation()}>
        {target <= 1 ? (
          <button
            className={`check-btn ${habit.completed ? '' : 'unchecked'}`}
            draggable={false}
            onClick={() => setHabitCount(habit.id, count >= 1 ? 0 : 1)}
            aria-label={habit.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            {habit.completed ? <Check size={16} /> : <Square size={16} />}
          </button>
        ) : (
          <div className="count-marks" role="group" aria-label={`${count} of ${target} done`}>
            {Array.from({ length: target }).map((_, i) => (
              <button
                key={i}
                className={`count-mark ${i < count ? 'filled' : ''}`}
                draggable={false}
                onClick={() => setHabitCount(habit.id, count === i + 1 ? i : i + 1)}
                aria-label={`Mark ${i + 1} of ${target}`}
              />
            ))}
          </div>
        )}
        <ActionMenu onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

export default function TodayView({
  habits, addHabit, setHabitCount, editHabit, deleteHabit, reorderHabits,
  groups, addGroup, toggleGroupCollapsed, deleteGroup,
  onBeginNewDay,
  weeklyHabits, setWeeklyHabits,
  todos, toggleTodo, removeFromFocus, reorderFocusTodos, promoteToSchedule, makeFocus, focusChore,
  todoSectionCollapsed, setTodoSectionCollapsed,
  isHolidayMode, toggleHolidayMode,
  chores, resetChore,
  scratchpad, setScratchpad,
  renameGroup, reorderGroups,
  dailyNoteText, setDailyNoteText, dailyNoteImage, setDailyNoteImage,
}) {
  const [name, setName] = useState('');
  const [newTarget, setNewTarget] = useState(1);
  const [newWeekly, setNewWeekly] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDragId, setGroupDragId] = useState(null);
  const [groupDragOverId, setGroupDragOverId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupEditName, setGroupEditName] = useState('');

  const [editingHabit, setEditingHabit] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', targetCount: 1, groupId: '', cadence: 'day' });

  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [wName, setWName] = useState('');
  const [wDays, setWDays] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [scratchpad]);

  function submitHabit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    addHabit({ name: name.trim(), targetCount: parseInt(newTarget, 10) || 1, cadence: newWeekly ? 'week' : 'day' });
    setName('');
    setNewTarget(1);
    setNewWeekly(false);
  }

  function submitGroup(e) {
    e.preventDefault();
    if (!groupName.trim()) return;
    addGroup(groupName.trim());
    setGroupName('');
    setAddingGroup(false);
  }

  function startEditGroup(group) {
    setGroupEditName(group.name);
    setEditingGroupId(group.id);
  }
  function commitEditGroup(id) {
    if (groupEditName.trim()) renameGroup(id, groupEditName.trim());
    setEditingGroupId(null);
  }

  function openEdit(habit) {
    setEditDraft({ name: habit.name, targetCount: habit.targetCount || 1, groupId: habit.groupId || '', cadence: habit.cadence || 'day' });
    setEditingHabit(habit);
  }
  function submitEdit(e) {
    e.preventDefault();
    editHabit(editingHabit.id, { name: editDraft.name, targetCount: parseInt(editDraft.targetCount, 10) || 1, groupId: editDraft.groupId || null, cadence: editDraft.cadence });
    setEditingHabit(null);
  }

  function toggleWDay(day) {
    if (day === 'weekend') {
      setWDays((prev) => (hasWeekend(prev) ? prev.filter((d) => d !== 'sat' && d !== 'sun') : [...prev, 'sat', 'sun']));
      return;
    }
    setWDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function addWeeklyHabit(e) {
    e.preventDefault();
    if (!wName.trim() || wDays.length === 0) return;
    setWeeklyHabits([...weeklyHabits, { id: Date.now(), name: wName.trim(), days: wDays }]);
    setWName('');
    setWDays([]);
  }
  function deleteWeeklyHabit(id) {
    setWeeklyHabits(weeklyHabits.filter((w) => w.id !== id));
  }

  function handleScratchpadKeyDown(e) {
    if (e.key === 'Enter') {
      const el = e.target;
      const val = el.value;
      const start = el.selectionStart;
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLine = val.substring(lineStart, start);
      const bulletMatch = currentLine.match(/^(\s*)(\u2022|-|\*)\s+(.*)/);
      if (bulletMatch) {
        e.preventDefault();
        const content = bulletMatch[3].trim();
        if (content === '') {
          setScratchpad(val.substring(0, lineStart) + val.substring(start));
        } else {
          const addition = '\n' + bulletMatch[1] + '\u2022 ';
          setScratchpad(val.substring(0, start) + addition + val.substring(start));
        }
      }
    }
  }

  const focusItems = todos.filter((t) => t.isFocus && !t.completed);
  const workMins = focusItems.filter((t) => t.category === 'work').reduce((s, i) => s + (i.durationMins || 30), 0);
  const nonWorkMins = focusItems.filter((t) => t.category !== 'work').reduce((s, i) => s + (i.durationMins || 30), 0);
  const overCapacity = workMins > 120 || nonWorkMins > 60;

  const overdueChores = chores.filter(isChoreOverdue);
  const urgentTodos = todos.filter((t) => !t.completed && t.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 3);
  const showBanner = overdueChores.length > 0 || urgentTodos.length > 0;

  const ungroupedHabits = habits.filter((h) => !h.groupId);

  function habitDragProps(h) {
    return {
      onDragStart: () => setDragId(h.id),
      onDragOver: (e) => { e.preventDefault(); setDragOverId(h.id); },
      onDragLeave: () => setDragOverId(null),
      onDrop: (e) => {
        e.stopPropagation();
        if (dragId) reorderHabits(dragId, h.id, h.groupId || null);
        setDragId(null);
        setDragOverId(null);
      },
    };
  }

  function groupContainerDropProps(groupId) {
    return {
      onDragOver: (e) => e.preventDefault(),
      onDrop: () => {
        if (dragId) reorderHabits(dragId, null, groupId || null);
        setDragId(null);
        setDragOverId(null);
      },
    };
  }

  return (
    <div className="view">
      <DailyNote text={dailyNoteText} setText={setDailyNoteText} image={dailyNoteImage} setImage={setDailyNoteImage} />

      <div className="section-row">
        <h2 className="section-title">Today</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label className="toggle-pill">
            <input type="checkbox" checked={isHolidayMode} onChange={toggleHolidayMode} />
            Holiday mode
          </label>
          <button className="btn" onClick={onBeginNewDay}>Begin a new day</button>
        </div>
      </div>

      {focusItems.length > 0 && (
        <div className="collapsible">
          <button className="collapsible-header" onClick={() => setTodoSectionCollapsed(!todoSectionCollapsed)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {todoSectionCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              Daily focus
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({focusItems.length})</span>
            </span>
          </button>
          {!todoSectionCollapsed && (
            <div className="collapsible-body" style={{ padding: 0 }}>
              {focusItems.map((todo) => (
                <div
                  key={todo.id}
                  className={`day-row day-row-todo ${dragOverId === todo.id ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={() => setDragId(todo.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(todo.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={() => { if (dragId) reorderFocusTodos(dragId, todo.id); setDragId(null); setDragOverId(null); }}
                >
                  <div className="card-left">
                    <span className="card-label" style={{ fontWeight: 500 }}>{todo.name}</span>
                    {todo.dueDate && <span className="pill pill-red">Due {todo.dueDate}</span>}
                  </div>
                  <div className="day-row-actions" draggable={false} onDragStart={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm" onClick={() => promoteToSchedule(todo.id)}>Schedule</button>
                    <button className="btn btn-primary btn-sm" onClick={() => toggleTodo(todo.id)}>Done</button>
                    <button className="btn-ghost btn-danger" onClick={() => removeFromFocus(todo.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {groups.map((group) => {
        const items = habits.filter((h) => h.groupId === group.id);
        return (
          <div
            className={`collapsible ${groupDragOverId === group.id ? 'group-drag-over' : ''}`}
            key={group.id}
            draggable={editingGroupId !== group.id}
            onDragStart={() => setGroupDragId(group.id)}
            onDragOver={(e) => { e.preventDefault(); setGroupDragOverId(group.id); }}
            onDragLeave={() => setGroupDragOverId(null)}
            onDrop={() => {
              if (groupDragId) reorderGroups(groupDragId, group.id);
              setGroupDragId(null);
              setGroupDragOverId(null);
            }}
          >
            <div className="collapsible-header group-header">
              <span
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}
                onClick={() => toggleGroupCollapsed(group.id)}
              >
                {group.collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                {editingGroupId === group.id ? (
                  <input
                    type="text"
                    className="group-name-input"
                    value={groupEditName}
                    onChange={(e) => setGroupEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitEditGroup(group.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEditGroup(group.id); }
                      if (e.key === 'Escape') { e.preventDefault(); setEditingGroupId(null); }
                    }}
                    autoFocus
                  />
                ) : (
                  <span>{group.name}</span>
                )}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({items.length})</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span
                  role="button"
                  tabIndex={0}
                  className="btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={(e) => { e.stopPropagation(); startEditGroup(group); }}
                >
                  Rename
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className="btn-ghost btn-danger"
                  style={{ fontSize: 11 }}
                  onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                >
                  Remove group
                </span>
              </span>
            </div>
            {!group.collapsed && (
              <div className="collapsible-body" style={{ padding: 0 }} {...groupContainerDropProps(group.id)}>
                {items.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 16px' }}>No habits in this group yet — drag one here.</p>
                ) : (
                  items.map((habit) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      dragOver={dragOverId === habit.id}
                      setHabitCount={setHabitCount}
                      onEdit={() => openEdit(habit)}
                      onDelete={() => deleteHabit(habit.id)}
                      {...habitDragProps(habit)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="day-list" {...groupContainerDropProps(null)}>
        {groups.length > 0 && ungroupedHabits.length > 0 && (
          <div style={{ padding: '8px 14px 0', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>
            Ungrouped
          </div>
        )}
        {ungroupedHabits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            dragOver={dragOverId === habit.id}
            setHabitCount={setHabitCount}
            onEdit={() => openEdit(habit)}
            onDelete={() => deleteHabit(habit.id)}
            {...habitDragProps(habit)}
          />
        ))}
        {ungroupedHabits.length === 0 && groups.length === 0 && (
          <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>No habits yet — add one below.</div>
        )}
      </div>

      {addingGroup ? (
        <form className="form-row" onSubmit={submitGroup} style={{ marginTop: -6 }}>
          <input type="text" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
          <button type="submit" className="btn btn-primary">Add group</button>
          <button type="button" className="btn" onClick={() => setAddingGroup(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn" style={{ marginTop: -6, marginBottom: 20 }} onClick={() => setAddingGroup(true)}>
          <Plus size={13} /> New group
        </button>
      )}

      <p className={`capacity-text ${overCapacity ? 'over' : ''}`}>
        Focus workload: {(workMins / 60).toFixed(1)}h work / 2.0h max &middot; {(nonWorkMins / 60).toFixed(1)}h other / 1.0h max
      </p>

      <div className="scratchpad-box">
        <h4>Scratchpad</h4>
        <textarea
          ref={textareaRef}
          className="scratchpad-textarea"
          placeholder="Rough notes for today..."
          value={scratchpad}
          onChange={(e) => setScratchpad(e.target.value)}
          onKeyDown={handleScratchpadKeyDown}
        />
      </div>

      {showBanner && (
        <div className="banner">
          <h3>Needs attention</h3>
          {overdueChores.map((chore) => {
            const existing = todos.find((t) => t.choreId === chore.id && !t.completed);
            return (
              <div className="suggestion-pill" key={chore.id}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{chore.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--red)' }}>Chore is due</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {existing && existing.isFocus ? (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>In focus</span>
                  ) : (
                    <button className="btn" onClick={() => focusChore(chore)}>
                      <Sparkles size={12} /> Focus
                    </button>
                  )}
                  <button className="btn" onClick={() => resetChore(chore.id)}>Mark done</button>
                </div>
              </div>
            );
          })}
          {urgentTodos.map((task) => (
            <div className="suggestion-pill" key={task.id}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{task.name}</div>
                <div style={{ fontSize: 11, color: 'var(--red)' }}>Due {task.dueDate}</div>
              </div>
              {task.isFocus ? (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>In focus</span>
              ) : (
                <button className="btn" onClick={() => makeFocus(task.id)}><Sparkles size={12} /> Focus</button>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="form-row" onSubmit={submitHabit}>
        <input type="text" placeholder="Add a habit" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          type="number"
          min="1"
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
          style={{ width: 56 }}
          title={newWeekly ? 'How many times per week' : 'How many times per day (e.g. 3 for 3 glasses of water)'}
        />
        <label className="toggle-pill">
          <input type="checkbox" checked={newWeekly} onChange={(e) => setNewWeekly(e.target.checked)} />
          Weekly goal
        </label>
        <button type="submit" className="btn btn-primary">Add habit</button>
      </form>
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: -14, marginBottom: 20 }}>
        A weekly goal carries over all week and only resets once a new week starts — missing a day won't count against it.
      </p>

      <div className="collapsible">
        <button className="collapsible-header" onClick={() => setWeeklyOpen((o) => !o)}>
          Day-specific habits
          <span className="chev">{weeklyOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
        </button>
        {weeklyOpen && (
          <div className="collapsible-body">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              These appear automatically in the list above on the days you choose, whenever you click "Begin a new day."
            </p>
            <form onSubmit={addWeeklyHabit} style={{ marginBottom: 14 }}>
              <div className="form-row" style={{ marginBottom: 8 }}>
                <input type="text" placeholder="Habit name" value={wName} onChange={(e) => setWName(e.target.value)} />
              </div>
              <div className="weekday-row">
                {WEEKDAYS.map((d) => (
                  <button
                    type="button"
                    key={d.key}
                    className={`weekday-chip ${wDays.includes(d.key) ? 'selected' : ''}`}
                    onClick={() => toggleWDay(d.key)}
                  >
                    {d.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`weekday-chip ${hasWeekend(wDays) ? 'selected' : ''}`}
                  onClick={() => toggleWDay('weekend')}
                  title="Weekend (Saturday & Sunday)"
                >
                  {WEEKEND_CHIP.label}
                </button>
                <button type="submit" className="btn btn-primary" style={{ marginLeft: 8 }}>Add</button>
              </div>
            </form>

            {weeklyHabits.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No day-specific habits yet.</p>
            ) : (
              weeklyHabits.map((w) => (
                <div className="weekly-habit-row" key={w.id}>
                  <div className="weekly-habit-info">
                    <span style={{ fontSize: 13 }}>{w.name}</span>
                    <div className="weekly-habit-days">
                      {dayBadges(w.days).map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                  </div>
                  <button className="chore-remove" onClick={() => deleteWeeklyHabit(w.id)} aria-label="Delete">
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {editingHabit && (
        <div className="modal-backdrop" onClick={() => setEditingHabit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit habit</h2>
            <form onSubmit={submitEdit}>
              <div className="modal-row">
                <label>Name</label>
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="modal-row">
                <label className="toggle-pill" style={{ width: 'fit-content' }}>
                  <input
                    type="checkbox"
                    checked={editDraft.cadence === 'week'}
                    onChange={(e) => setEditDraft({ ...editDraft, cadence: e.target.checked ? 'week' : 'day' })}
                  />
                  Weekly goal
                </label>
              </div>
              <div className="modal-row">
                <label>{editDraft.cadence === 'week' ? 'Times per week' : 'Times per day'}</label>
                <input
                  type="number"
                  min="1"
                  value={editDraft.targetCount}
                  onChange={(e) => setEditDraft({ ...editDraft, targetCount: e.target.value })}
                />
              </div>
              <div className="modal-row">
                <label>Group</label>
                <select value={editDraft.groupId || ''} onChange={(e) => setEditDraft({ ...editDraft, groupId: e.target.value })}>
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setEditingHabit(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
