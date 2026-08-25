import { useMemo, useRef } from 'react';
import { Check, Square, X } from 'lucide-react';

const START_HOUR = 7;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TIME_OPTIONS = [];
for (let h = START_HOUR; h <= END_HOUR; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === END_HOUR && m > 0) break;
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function getUpcomingHalfHourPx() {
  const now = new Date();
  let h = now.getHours();
  let m = now.getMinutes();
  if (m > 0 && m <= 30) m = 30;
  else if (m > 30) { m = 0; h += 1; }
  if (h < START_HOUR) { h = START_HOUR; m = 0; }
  if (h > END_HOUR) { h = END_HOUR; m = 0; }
  return Math.max(0, Math.min((END_HOUR - START_HOUR) * 60, (h - START_HOUR) * 60 + m));
}

function formatTime(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function ScheduleView({ tasks, setTasks, formRef }) {
  const nameRef = useRef(null);
  const timeSelectRef = useRef(null);

  function addTask(e) {
    e.preventDefault();
    const name = nameRef.current.value.trim();
    if (!name) return;
    const timeVal = timeSelectRef.current.value;
    let topPx;
    if (timeVal) {
      const [hStr, mStr] = timeVal.split(':');
      topPx = Math.max(0, Math.min((END_HOUR - START_HOUR) * 60, (parseInt(hStr, 10) - START_HOUR) * 60 + parseInt(mStr, 10)));
    } else {
      topPx = getUpcomingHalfHourPx();
    }
    setTasks([...tasks, { id: 's_' + Date.now(), name, topPx, durationMins: 30, category: 'personal', completed: false }]);
    nameRef.current.value = '';
    timeSelectRef.current.value = '';
  }

  function toggleTask(id) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  }

  function deleteTask(id) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  function startDrag(e, id) {
    if (e.target.closest('.resizer') || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const startY = e.clientY;
    const initialTop = task.topPx;

    function onMove(moveEvent) {
      const deltaY = moveEvent.clientY - startY;
      let newTop = initialTop + deltaY;
      newTop = Math.max(0, Math.min((END_HOUR - START_HOUR) * 60, Math.round(newTop / 15) * 15));
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, topPx: newTop } : t)));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startResize(e, id) {
    e.stopPropagation();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const startY = e.clientY;
    const initialDuration = task.durationMins;

    function onMove(moveEvent) {
      const deltaY = moveEvent.clientY - startY;
      const deltaMins = Math.round(deltaY / 15) * 15;
      const newDuration = Math.max(15, initialDuration + deltaMins);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, durationMins: newDuration } : t)));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const clusters = useMemo(() => {
    const processed = tasks.map((t) => ({
      ...t,
      start: t.topPx,
      end: t.topPx + Math.max(15, t.durationMins),
    }));
    processed.sort((a, b) => a.start - b.start);
    const groups = [];
    processed.forEach((task) => {
      let added = false;
      for (const g of groups) {
        if (g.some((c) => !(task.start >= c.end || task.end <= c.start))) {
          g.push(task);
          added = true;
          break;
        }
      }
      if (!added) groups.push([task]);
    });
    return groups;
  }, [tasks]);

  return (
    <div className="view">
      <form className="form-row" onSubmit={addTask}>
        <input type="text" placeholder="Add a timed task" ref={nameRef} required />
        <select ref={timeSelectRef} style={{ minWidth: 130 }} defaultValue="">
          <option value="">Auto (next 30m)</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">Add to schedule</button>
      </form>

      <div className="timeline-wrap">
        <h3 className="section-title">Timeline</h3>
        <div className="timeline-board">
          {HOURS.map((h, idx) => (
            <div className="timeline-hour-row" style={{ top: idx * 60 }} key={h}>
              <span className="timeline-label">{formatTime(h, 0)}</span>
            </div>
          ))}

          {clusters.map((cluster, ci) =>
            cluster.map((task, colIdx) => {
              const total = cluster.length;
              const colWidth = 100 / total;
              const left = colIdx * colWidth;
              const startHour = Math.floor(START_HOUR + task.topPx / 60);
              const startMin = Math.round((task.topPx % 60) / 15) * 15;
              const endTotal = startHour * 60 + startMin + task.durationMins;
              const endHour = Math.floor(endTotal / 60);
              const endMin = endTotal % 60;
              const style = {
                top: task.topPx,
                height: Math.max(25, task.durationMins),
              };
              if (total === 1) {
                style.left = 62;
                style.right = 8;
                style.width = 'auto';
              } else {
                style.left = `calc(62px + ${left}%)`;
                style.width = `calc(${colWidth}% - 14px)`;
              }
              return (
                <div
                  key={task.id}
                  className={`schedule-block cat-${task.category} ${task.completed ? 'completed' : ''}`}
                  style={style}
                  onMouseDown={(e) => startDrag(e, task.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 6 }}>
                    <button
                      className={`check-btn ${task.completed ? '' : 'unchecked'}`}
                      onClick={() => toggleTask(task.id)}
                      aria-label="Toggle complete"
                      style={{ flexShrink: 0 }}
                    >
                      {task.completed ? <Check size={13} /> : <Square size={13} />}
                    </button>
                    <span className="task-title-text" style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatTime(startHour, startMin)}&ndash;{formatTime(endHour, endMin)}
                    </span>
                    <button className="chore-remove" onClick={() => deleteTask(task.id)} aria-label="Delete">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="resizer" onMouseDown={(e) => startResize(e, task.id)} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
