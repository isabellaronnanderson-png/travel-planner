import { useState, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import Header from './components/Header';
import TodayView from './views/TodayView';
import ScheduleView from './views/ScheduleView';
import TodoView from './views/TodoView';
import ChoresView from './views/ChoresView';
import InsightsView from './views/InsightsView';
import './App.css';

const DEFAULT_TAB_ORDER = ['habits', 'todo', 'chores', 'schedule', 'insights'];

const DEFAULT_WEEKLY_HABITS = [];

const DEFAULT_HABITS = [
  { id: 'h1', name: 'Walk in the garden', completed: false, count: 0, targetCount: 1, groupId: null },
  { id: 'h2', name: 'Sip tea', completed: false, count: 0, targetCount: 1, groupId: null },
  { id: 'h3', name: 'Read a chapter', completed: false, count: 0, targetCount: 1, groupId: null },
];

const DEFAULT_TODOS = [
  { id: 't1', name: 'Submit project proposal', category: 'work', durationMins: 45, dueDate: '', isFocus: true, completed: false, completedAt: null },
  { id: 't2', name: 'Send follow-up email', category: 'admin', durationMins: 30, dueDate: '', isFocus: false, completed: false, completedAt: null },
  { id: 't3', name: 'Pick up dry-cleaning', category: 'errands', durationMins: 30, dueDate: '', isFocus: false, completed: false, completedAt: null },
];

const DEFAULT_CHORES = [
  { id: 1, name: 'Vacuum room', group: 'house', freqVal: 3, freqUnit: 'days', lastDone: Date.now() - 1.5 * 24 * 60 * 60 * 1000 },
  { id: 2, name: 'Mop kitchen floor', group: 'house', freqVal: 1, freqUnit: 'weeks', lastDone: Date.now() - 5 * 24 * 60 * 60 * 1000 },
  { id: 3, name: 'Cut hair', group: 'beauty', freqVal: 6, freqUnit: 'months', lastDone: Date.now() - 60 * 24 * 60 * 60 * 1000 },
  { id: 4, name: 'Replace toothbrush head', group: 'health', freqVal: 3, freqUnit: 'months', lastDone: Date.now() - 89 * 24 * 60 * 60 * 1000 },
];

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEK_EPOCH = new Date('2024-01-01T00:00:00Z').getTime(); // a Monday
function weekKeyFor(dateIso) {
  const t = new Date(dateIso).getTime();
  return Math.floor((t - WEEK_EPOCH) / (7 * 24 * 60 * 60 * 1000));
}

function reorderById(list, draggedId, targetId) {
  const arr = [...list];
  const fromIdx = arr.findIndex((x) => x.id === draggedId);
  const toIdx = arr.findIndex((x) => x.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return list;
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  return arr;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('habits');
  const [tabOrder, setTabOrder] = useLocalStorage('planner_tab_order', DEFAULT_TAB_ORDER);
  const [coverImage, setCoverImage] = useLocalStorage('planner_cover_image', null);
  const [coverPosition, setCoverPosition] = useLocalStorage('planner_cover_position', { x: 50, y: 50 });
  const [currentDate, setCurrentDate] = useLocalStorage('planner_current_date', new Date().toISOString());
  const [weekKey, setWeekKey] = useLocalStorage('planner_week_key', weekKeyFor(new Date().toISOString()));
  const [title, setTitle] = useLocalStorage('planner_title', "isabella's planner");

  const [habits, setHabits] = useLocalStorage('planner_habits', DEFAULT_HABITS);
  const [habitHistory, setHabitHistory] = useLocalStorage('planner_habit_history', []);
  const [weeklyHabits, setWeeklyHabits] = useLocalStorage('planner_weekly_habits', DEFAULT_WEEKLY_HABITS);
  const [groups, setGroups] = useLocalStorage('planner_habit_groups', []);
  const [todoSectionCollapsed, setTodoSectionCollapsed] = useLocalStorage('planner_todo_section_collapsed', false);

  const [scheduleTasks, setScheduleTasks] = useLocalStorage('planner_schedule', []);

  const [todos, setTodos] = useLocalStorage('planner_todos', DEFAULT_TODOS);
  const [isHolidayMode, setIsHolidayMode] = useLocalStorage('planner_holiday_mode', false);
  const [scratchpad, setScratchpad] = useLocalStorage('planner_scratchpad', '');
  const [dailyNoteText, setDailyNoteText] = useLocalStorage('planner_daily_note_text', '');
  const [dailyNoteImage, setDailyNoteImage] = useLocalStorage('planner_daily_note_image', null);

  const [chores, setChores] = useLocalStorage('planner_chores', DEFAULT_CHORES);

  const safeTabOrder = [...tabOrder, ...DEFAULT_TAB_ORDER.filter((k) => !tabOrder.includes(k))].filter((k) => k !== 'weekend');

  // One-time migration: fold any existing separate weekend tasks into
  // day-specific habits tagged for Saturday + Sunday, then retire the old data.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('planner_weekend');
      const alreadyMigrated = localStorage.getItem('planner_weekend_migrated');
      if (raw && !alreadyMigrated) {
        const oldWeekend = JSON.parse(raw);
        if (Array.isArray(oldWeekend) && oldWeekend.length > 0) {
          setWeeklyHabits((prev) => {
            const existingNames = new Set(prev.map((w) => w.name));
            const additions = oldWeekend
              .filter((w) => w && w.name && !existingNames.has(w.name))
              .map((w, i) => ({ id: Date.now() + i, name: w.name, days: ['sat', 'sun'] }));
            return [...prev, ...additions];
          });
        }
        localStorage.setItem('planner_weekend_migrated', 'true');
      }
      // eslint-disable-next-line no-empty
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep habit history clean: if a name no longer belongs to any current
  // habit or day-specific habit definition, it was deleted — drop it from
  // history too (including any stragglers left over from before this existed).
  useEffect(() => {
    const validNames = new Set([...habits.map((h) => h.name), ...weeklyHabits.map((w) => w.name)]);
    setHabitHistory((prev) => {
      let changed = false;
      const next = prev.map((entry) => {
        const filtered = (entry.snapshot || []).filter((item) => validNames.has(item.name));
        if (filtered.length !== (entry.snapshot || []).length) changed = true;
        return { ...entry, snapshot: filtered };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, weeklyHabits]);

  function resetChore(id) {
    setChores(chores.map((c) => (c.id === id ? { ...c, lastDone: Date.now() } : c)));
  }

  function isWeekendOrHoliday() {
    const day = new Date().getDay();
    return day === 0 || day === 6 || isHolidayMode;
  }

  function isChoreOverdueLocal(chore) {
    const totalGoalMs = chore.freqVal * (chore.freqUnit === 'weeks' ? 7 : chore.freqUnit === 'months' ? 30 : 1) * 24 * 60 * 60 * 1000;
    return Date.now() - chore.lastDone >= totalGoalMs;
  }

  // Pulls up to 3 tasks from the bank into focus, prioritizing work on
  // workdays, boosting overdue chores and due-dated items, and topping up
  // whichever category has been neglected lately. Only tops up to 3 total —
  // it never removes anything the person already carried over or added by hand.
  function autoFillFocus(todosList) {
    let list = [...todosList];

    // Make sure overdue chores have a bank entry so they're eligible to be pulled in.
    chores.filter(isChoreOverdueLocal).forEach((chore) => {
      const existing = list.find((t) => t.choreId === chore.id && !t.completed);
      if (!existing) {
        list.push({ id: 't_chore_' + chore.id + '_' + Date.now(), choreId: chore.id, name: chore.name, category: 'chores', durationMins: 30, dueDate: '', isFocus: false, completed: false, completedAt: null });
      }
    });

    const weekendOrHoliday = isWeekendOrHoliday();
    const isWorkday = !weekendOrHoliday;

    let bankItems = list.filter((t) => !t.isFocus && !t.completed);
    if (weekendOrHoliday) bankItems = bankItems.filter((t) => t.category !== 'work');

    const completedTodos = list.filter((t) => t.completed);
    const catCounts = { work: 0, admin: 0, errands: 0, chores: 0, personal: 0 };
    completedTodos.forEach((t) => { if (catCounts[t.category] !== undefined) catCounts[t.category]++; });
    const neglectedCat = Object.keys(catCounts).reduce((a, b) => (catCounts[a] < catCounts[b] ? a : b));

    const scored = bankItems
      .map((task) => {
        let score = 0;
        if (!weekendOrHoliday) {
          if (task.category === 'work') score += 15;
          if (task.category === 'admin') score += 10;
          if (task.category === 'errands') score += 5;
        }
        if (task.dueDate) score += 20;
        if (task.choreId) score += 8;
        if (task.category === neglectedCat) score += 5;
        return { id: task.id, score };
      })
      .sort((a, b) => b.score - a.score);

    const activeFocusItems = list.filter((t) => t.isFocus && !t.completed);
    let workMins = activeFocusItems.filter((t) => t.category === 'work').reduce((s, i) => s + (i.durationMins || 30), 0);
    let nonWorkMins = activeFocusItems.filter((t) => t.category !== 'work').reduce((s, i) => s + (i.durationMins || 30), 0);
    let errandCount = activeFocusItems.filter((t) => t.category === 'errands').length;

    for (const { id } of scored) {
      const activeCount = list.filter((t) => t.isFocus && !t.completed).length;
      if (activeCount >= 3) break;

      const candidate = list.find((t) => t.id === id);
      if (!candidate) continue;
      const candidateMins = candidate.durationMins || 30;

      if (isWorkday && candidate.category === 'errands' && errandCount >= 1) continue;

      if (candidate.category === 'work') {
        if (workMins + candidateMins <= 120) {
          list = list.map((t) => (t.id === id ? { ...t, isFocus: true } : t));
          workMins += candidateMins;
        }
      } else if (nonWorkMins + candidateMins <= 60) {
        list = list.map((t) => (t.id === id ? { ...t, isFocus: true } : t));
        nonWorkMins += candidateMins;
        if (candidate.category === 'errands') errandCount++;
      }
    }

    return list;
  }

  function beginNewDay() {
    const closingDateKey = currentDate.split('T')[0];
    // Weekly-goal habits aren't day-by-day — leave them out of the daily
    // consistency snapshot entirely so a mid-week gap never reads as a miss.
    const snapshot = habits.filter((h) => h.cadence !== 'week').map((h) => ({ name: h.name, completed: h.completed }));
    setHabitHistory([{ date: closingDateKey, snapshot }, ...habitHistory].slice(0, 14));

    const newWeekKey = weekKeyFor(new Date().toISOString());
    const isNewWeek = newWeekKey !== weekKey;

    const todaysWeekday = WEEKDAY_KEYS[new Date().getDay()];
    const baseHabits = habits
      .filter((h) => !h.fromWeekly)
      .map((h) => {
        if (h.cadence === 'week') {
          // Carry over untouched until a new week begins.
          return isNewWeek ? { ...h, completed: false, count: 0 } : h;
        }
        return { ...h, completed: false, count: 0 };
      });
    const injected = weeklyHabits
      .filter((w) => w.days.includes(todaysWeekday))
      .map((w) => ({ id: 'wh_' + w.id, name: w.name, completed: false, count: 0, targetCount: 1, groupId: w.groupId || null, fromWeekly: true }));
    setHabits([...baseHabits, ...injected]);
    setCurrentDate(new Date().toISOString());
    if (isNewWeek) setWeekKey(newWeekKey);

    setScheduleTasks([]);

    let nextTodos = todos.map((t) => (t.isFocus && t.completed ? { ...t, isFocus: false } : t));
    if (isWeekendOrHoliday()) {
      nextTodos = nextTodos.map((t) => (t.isFocus && t.category === 'work' ? { ...t, isFocus: false } : t));
    }

    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    nextTodos = nextTodos.filter((t) => !(t.completed && t.completedAt && Date.now() - t.completedAt >= fourteenDays));

    nextTodos = autoFillFocus(nextTodos);

    setTodos(nextTodos);
  }

  // ---- Habit actions ----
  function addHabit({ name, targetCount = 1, groupId = null, cadence = 'day' }) {
    setHabits([...habits, { id: 'h_' + Date.now(), name, completed: false, count: 0, targetCount: Math.max(1, targetCount), groupId: groupId || null, cadence }]);
  }

  // Click on the Nth mark: if it's already at that count, step back to just
  // before it (uncheck); otherwise jump forward to fill through it.
  function setHabitCount(id, newCount) {
    setHabits(
      habits.map((h) => {
        if (h.id !== id) return h;
        const target = h.targetCount || 1;
        const clamped = Math.max(0, Math.min(target, newCount));
        return { ...h, count: clamped, completed: clamped >= target };
      })
    );
  }

  function editHabit(id, updates) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const trimmedName = (updates.name || '').trim();
    if (!trimmedName) return;
    const nextTarget = Math.max(1, updates.targetCount || 1);
    setHabits(
      habits.map((h) =>
        h.id === id
          ? { ...h, name: trimmedName, targetCount: nextTarget, count: Math.min(h.count || 0, nextTarget), groupId: updates.groupId || null, cadence: updates.cadence || 'day' }
          : h
      )
    );
    if (trimmedName !== habit.name) {
      setHabitHistory(
        habitHistory.map((entry) => ({
          ...entry,
          snapshot: (entry.snapshot || []).map((item) => (item.name === habit.name ? { ...item, name: trimmedName } : item)),
        }))
      );
    }
    if (habit.fromWeekly) {
      const weeklyId = id.replace(/^wh_/, '');
      setWeeklyHabits((prev) => prev.map((w) => (String(w.id) === weeklyId ? { ...w, groupId: updates.groupId || null } : w)));
    }
  }

  function deleteHabit(id) {
    const habit = habits.find((h) => h.id === id);
    setHabits(habits.filter((h) => h.id !== id));
    if (habit) {
      setHabitHistory(
        habitHistory.map((entry) => ({
          ...entry,
          snapshot: (entry.snapshot || []).filter((item) => item.name !== habit.name),
        }))
      );
    }
  }

  function reorderHabits(draggedId, targetId, targetGroupId) {
    const dragged = habits.find((h) => h.id === draggedId);

    setHabits((prev) => {
      const draggedIdx = prev.findIndex((h) => h.id === draggedId);
      if (draggedIdx === -1) return prev;
      const list = [...prev];
      const [removed] = list.splice(draggedIdx, 1);
      const updatedDragged = { ...removed, groupId: targetGroupId || null };

      if (targetId) {
        const toIdx = list.findIndex((h) => h.id === targetId);
        if (toIdx === -1) {
          list.push(updatedDragged);
        } else {
          list.splice(toIdx, 0, updatedDragged);
        }
      } else {
        // No specific target row — drop was on the group's empty space, so
        // append after the last habit already in that group.
        let insertAt = list.length;
        for (let i = list.length - 1; i >= 0; i--) {
          if ((list[i].groupId || null) === (targetGroupId || null)) {
            insertAt = i + 1;
            break;
          }
        }
        list.splice(insertAt, 0, updatedDragged);
      }
      return list;
    });

    // Recurring day-specific habits remember whichever group they were last
    // dragged into, so they respawn there each time they're injected.
    if (dragged && dragged.fromWeekly) {
      const weeklyId = draggedId.replace(/^wh_/, '');
      setWeeklyHabits((prev) => prev.map((w) => (String(w.id) === weeklyId ? { ...w, groupId: targetGroupId || null } : w)));
    }
  }

  // ---- Group actions ----
  function addGroup(name) {
    if (!name.trim()) return;
    setGroups([...groups, { id: 'g_' + Date.now(), name: name.trim(), collapsed: false }]);
  }
  function toggleGroupCollapsed(id) {
    setGroups(groups.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)));
  }
  function deleteGroup(id) {
    setGroups(groups.filter((g) => g.id !== id));
    setHabits(habits.map((h) => (h.groupId === id ? { ...h, groupId: null } : h)));
  }
  function renameGroup(id, newName) {
    if (!newName.trim()) return;
    setGroups(groups.map((g) => (g.id === id ? { ...g, name: newName.trim() } : g)));
  }
  function reorderGroups(draggedId, targetId) {
    setGroups((prev) => reorderById(prev, draggedId, targetId));
  }

  // ---- Todo actions (lifted so both Today and To-do tabs share one source of truth) ----
  function toggleTodo(id) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextDone = !t.completed;
        if (nextDone && t.choreId) resetChore(t.choreId);
        return { ...t, completed: nextDone, completedAt: nextDone ? Date.now() : null, isFocus: false };
      })
    );
    setScheduleTasks((prev) => prev.map((s) => (s.todoId === id ? { ...s, completed: !s.completed } : s)));
  }

  function editTodo(id, newName) {
    if (!newName || !newName.trim()) return;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, name: newName.trim() } : t)));
  }

  function deleteTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    setScheduleTasks((prev) => prev.filter((s) => s.todoId !== id));
  }

  // No hard cap — focus is now just "what I've chosen to work on today."
  function makeFocus(id) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, isFocus: true } : t)));
  }

  // Atomically find-or-create a todo for a chore, then focus it — avoids the
  // stale-state bug where creating and focusing in two steps could drop the item.
  function focusChore(chore) {
    setTodos((prev) => {
      const existing = prev.find((t) => t.choreId === chore.id && !t.completed);
      if (existing) {
        if (existing.isFocus) return prev;
        return prev.map((t) => (t.id === existing.id ? { ...t, isFocus: true } : t));
      }
      return [
        ...prev,
        { id: 't_' + Date.now(), choreId: chore.id, name: chore.name, category: 'chores', durationMins: 30, dueDate: '', isFocus: true, completed: false, completedAt: null },
      ];
    });
  }

  function removeFromFocus(id) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, isFocus: false } : t)));
  }

  function reorderFocusTodos(draggedId, targetId) {
    setTodos((prev) => reorderById(prev, draggedId, targetId));
  }

  function promoteToSchedule(id) {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const existing = scheduleTasks.find((s) => s.todoId === id);
    if (!existing) {
      const now = new Date();
      let h = now.getHours();
      let m = now.getMinutes();
      if (m > 0 && m <= 30) m = 30; else { m = 0; h += 1; }
      if (h < 7) { h = 7; m = 0; }
      if (h > 18) { h = 18; m = 0; }
      const topPx = Math.max(0, Math.min(660, (h - 7) * 60 + m));
      setScheduleTasks([
        ...scheduleTasks,
        { id: 's_' + Date.now(), todoId: target.id, name: target.name, topPx, durationMins: target.durationMins || 30, category: target.category || 'personal', completed: target.completed },
      ]);
    }
    setActiveTab('schedule');
  }

  function toggleHolidayMode() {
    const next = !isHolidayMode;
    setIsHolidayMode(next);
    if (next) {
      setTodos(todos.map((t) => (t.isFocus && t.category === 'work' ? { ...t, isFocus: false } : t)));
    }
  }

  return (
    <div className="app">
      <Header
        coverImage={coverImage}
        setCoverImage={setCoverImage}
        coverPosition={coverPosition}
        setCoverPosition={setCoverPosition}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabOrder={safeTabOrder}
        setTabOrder={setTabOrder}
        currentDate={currentDate}
        title={title}
        setTitle={setTitle}
      />

      {activeTab === 'habits' && (
        <TodayView
          habits={habits}
          addHabit={addHabit}
          setHabitCount={setHabitCount}
          editHabit={editHabit}
          deleteHabit={deleteHabit}
          reorderHabits={reorderHabits}
          groups={groups}
          addGroup={addGroup}
          toggleGroupCollapsed={toggleGroupCollapsed}
          deleteGroup={deleteGroup}
          renameGroup={renameGroup}
          reorderGroups={reorderGroups}
          onBeginNewDay={beginNewDay}
          weeklyHabits={weeklyHabits}
          setWeeklyHabits={setWeeklyHabits}
          todos={todos}
          toggleTodo={toggleTodo}
          removeFromFocus={removeFromFocus}
          reorderFocusTodos={reorderFocusTodos}
          promoteToSchedule={promoteToSchedule}
          makeFocus={makeFocus}
          focusChore={focusChore}
          todoSectionCollapsed={todoSectionCollapsed}
          setTodoSectionCollapsed={setTodoSectionCollapsed}
          isHolidayMode={isHolidayMode}
          toggleHolidayMode={toggleHolidayMode}
          chores={chores}
          resetChore={resetChore}
          scratchpad={scratchpad}
          setScratchpad={setScratchpad}
          dailyNoteText={dailyNoteText}
          setDailyNoteText={setDailyNoteText}
          dailyNoteImage={dailyNoteImage}
          setDailyNoteImage={setDailyNoteImage}
        />
      )}
      {activeTab === 'schedule' && (
        <ScheduleView tasks={scheduleTasks} setTasks={setScheduleTasks} />
      )}
      {activeTab === 'todo' && (
        <TodoView
          todos={todos}
          setTodos={setTodos}
          toggleTodo={toggleTodo}
          editTodo={editTodo}
          deleteTodo={deleteTodo}
          makeFocus={makeFocus}
          isHolidayMode={isHolidayMode}
        />
      )}
      {activeTab === 'chores' && (
        <ChoresView chores={chores} setChores={setChores} resetChore={resetChore} />
      )}
      {activeTab === 'insights' && (
        <InsightsView habits={habits} habitHistory={habitHistory} todos={todos} groups={groups} weeklyHabits={weeklyHabits} />
      )}
    </div>
  );
}
