import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import CategoryTag from '../components/CategoryTag';
import { CATEGORIES, CATEGORY_ORDER } from '../data/categories';

export default function TodoView({ todos, setTodos, toggleTodo, editTodo, deleteTodo, makeFocus, isHolidayMode }) {
  const nameRef = useRef(null);
  const catRef = useRef(null);
  const durRef = useRef(null);
  const dateRef = useRef(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [editName, setEditName] = useState('');

  function isWeekendOrHoliday() {
    const day = new Date().getDay();
    return day === 0 || day === 6 || isHolidayMode;
  }

  function addTodo(e) {
    e.preventDefault();
    const name = nameRef.current.value.trim();
    if (!name) return;
    setTodos([
      ...todos,
      {
        id: 't_' + Date.now(),
        name,
        category: catRef.current.value,
        durationMins: parseInt(durRef.current.value, 10) || 30,
        dueDate: dateRef.current.value,
        isFocus: false,
        completed: false,
        completedAt: null,
      },
    ]);
    nameRef.current.value = '';
    dateRef.current.value = '';
  }

  const weekendOrHoliday = isWeekendOrHoliday();
  let bankItems = todos.filter((t) => !t.isFocus && !t.completed);
  if (weekendOrHoliday) bankItems = bankItems.filter((t) => t.category !== 'work');
  bankItems = [...bankItems].sort((a, b) => {
    if (CATEGORY_ORDER[a.category] !== CATEGORY_ORDER[b.category]) return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return 0;
  });

  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const vaultItems = todos.filter((t) => t.completed && t.completedAt && Date.now() - t.completedAt <= fourteenDays);

  return (
    <div className="view">
      <div className="section-row">
        <h2 className="section-title">To-do</h2>
      </div>

      <form className="form-row" onSubmit={addTodo} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8 }}>
        <input type="text" placeholder="Add a task" ref={nameRef} required style={{ minWidth: 0 }} />
        <select ref={catRef} defaultValue="work">
          {Object.entries(CATEGORIES).map(([key, meta]) => (
            <option key={key} value={key}>{meta.label}</option>
          ))}
        </select>
        <select ref={durRef} defaultValue="30">
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
        </select>
        <input type="date" ref={dateRef} />
        <button type="submit" className="btn btn-primary">Add</button>
      </form>

      <div className="bank-box">
        <h3 className="section-title" style={{ marginBottom: 10 }}>Task bank</h3>
        <div className="bank-list">
          {bankItems.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing waiting right now.</div>}
          {bankItems.map((todo) => (
            <div key={todo.id} className="card">
              <div className="card-left">
                <span className="card-label" style={{ fontWeight: 500 }}>{todo.name}</span>
                <CategoryTag category={todo.category} />
                <span className="tag">{todo.durationMins || 30}m</span>
                {todo.dueDate && <span className="pill pill-red">Due {todo.dueDate}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <button className="btn" onClick={() => makeFocus(todo.id)}><Sparkles size={12} /> Focus</button>
                <button className="btn btn-primary" onClick={() => toggleTodo(todo.id)}>Done</button>
                <ActionMenu
                  onEdit={() => { setEditingTodo(todo); setEditName(todo.name); }}
                  onDelete={() => deleteTodo(todo.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="vault-box">
        <h3 className="section-title" style={{ marginBottom: 10 }}>Recently completed</h3>
        <div className="vault-list">
          {vaultItems.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing completed in the last two weeks yet.</div>}
          {vaultItems.map((todo) => (
            <div className="card completed" key={todo.id}>
              <div className="card-left">
                <span className="card-label">{todo.name}</span>
                <CategoryTag category={todo.category} />
              </div>
              <button className="btn-ghost" onClick={() => toggleTodo(todo.id)}>Reopen</button>
            </div>
          ))}
        </div>
      </div>

      {editingTodo && (
        <div className="modal-backdrop" onClick={() => setEditingTodo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit task</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                editTodo(editingTodo.id, editName);
                setEditingTodo(null);
              }}
            >
              <div className="modal-row">
                <label>Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setEditingTodo(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
