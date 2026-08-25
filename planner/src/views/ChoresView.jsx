import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';

const GROUPS = {
  house: 'House',
  beauty: 'Beauty & care',
  health: 'Health',
  work: 'Work & admin',
};

function goalMs(chore) {
  const mult = chore.freqUnit === 'weeks' ? 7 : chore.freqUnit === 'months' ? 30 : 1;
  return chore.freqVal * mult * 24 * 60 * 60 * 1000;
}

function progressFor(chore) {
  const total = goalMs(chore);
  const passed = Date.now() - chore.lastDone;
  let percent = Math.max(0, Math.min(100, (passed / total) * 100));
  const overdue = percent >= 100;
  const daysLeft = Math.ceil((total - passed) / (24 * 60 * 60 * 1000));
  return { percent, overdue, daysLeft };
}

export default function ChoresView({ chores, setChores, resetChore }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const [form, setForm] = useState({ name: '', group: 'house', freqVal: 3, freqUnit: 'days' });
  const [editDays, setEditDays] = useState(0);

  function submitAdd(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.freqVal) return;
    setChores([...chores, { id: Date.now(), name: form.name.trim(), group: form.group, freqVal: parseInt(form.freqVal, 10), freqUnit: form.freqUnit, lastDone: Date.now() }]);
    setForm({ name: '', group: 'house', freqVal: 3, freqUnit: 'days' });
    setAddOpen(false);
  }

  function openEdit(chore) {
    const { daysLeft } = progressFor(chore);
    setEditDays(Math.max(0, daysLeft));
    setEditTarget(chore);
  }

  function submitEdit(e) {
    e.preventDefault();
    const chore = editTarget;
    const total = goalMs(chore);
    const maxDays = Math.ceil(total / (24 * 60 * 60 * 1000));
    const clamped = Math.max(0, Math.min(maxDays, editDays));
    const targetMsLeft = clamped * 24 * 60 * 60 * 1000;
    setChores(chores.map((c) => (c.id === chore.id ? { ...c, lastDone: Date.now() - (total - targetMsLeft) } : c)));
    setEditTarget(null);
  }

  function confirmDelete() {
    setChores(chores.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function reorder(groupKey, sourceId, targetId) {
    const groupItems = chores.filter((c) => c.group === groupKey);
    const otherItems = chores.filter((c) => c.group !== groupKey);
    const sourceIdx = groupItems.findIndex((c) => c.id === sourceId);
    const targetIdx = groupItems.findIndex((c) => c.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const [moved] = groupItems.splice(sourceIdx, 1);
    groupItems.splice(targetIdx, 0, moved);
    setChores([...otherItems, ...groupItems]);
  }

  return (
    <div className="view">
      <div className="section-row">
        <h2 className="section-title">Chore tracker</h2>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={14} /> Add chore</button>
      </div>

      {Object.entries(GROUPS).map(([key, label]) => {
        const items = chores.filter((c) => c.group === key);
        if (items.length === 0) return null;
        return (
          <div className="chore-group" key={key}>
            <div className="chore-group-title">{label}</div>
            <div className="chore-list">
              {items.map((chore) => {
                const { percent, overdue, daysLeft } = progressFor(chore);
                let unit = chore.freqUnit;
                if (chore.freqVal === 1) unit = unit.slice(0, -1);
                return (
                  <div
                    key={chore.id}
                    className={`chore-row ${dragId === chore.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDragId(chore.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(chore.id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={() => { if (dragId) reorder(key, dragId, chore.id); setDragId(null); setDragOverId(null); }}
                  >
                    <span className="chore-drag-handle"><GripVertical size={16} /></span>
                    <div className="chore-main">
                      <div className="chore-top-row">
                        <span className="chore-name">{chore.name}</span>
                        <span className="chore-freq">every {chore.freqVal} {unit}</span>
                      </div>
                      <div className="chore-progress-bg">
                        <div className={`chore-progress-fill ${overdue ? 'overdue' : ''}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <span
                      className={`chore-status ${overdue ? 'overdue' : 'ok'}`}
                      onClick={() => openEdit(chore)}
                    >
                      {overdue ? 'Ready' : `${daysLeft}d left`}
                    </span>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => resetChore(chore.id)}>Done</button>
                    <button className="chore-remove" onClick={() => setDeleteTarget(chore)} aria-label="Remove chore">
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {chores.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No chores tracked yet. Add one to start.</p>
      )}

      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add chore</h2>
            <form onSubmit={submitAdd}>
              <div className="modal-row">
                <label>Chore</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vacuum room" autoFocus />
              </div>
              <div className="modal-row">
                <label>Category</label>
                <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
                  {Object.entries(GROUPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div className="modal-row">
                <label>Repeat every</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" min="1" value={form.freqVal} onChange={(e) => setForm({ ...form, freqVal: e.target.value })} style={{ width: 80 }} />
                  <select value={form.freqUnit} onChange={(e) => setForm({ ...form, freqUnit: e.target.value })}>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-backdrop" onClick={() => setEditTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Adjust timeline</h2>
            <p>Days remaining for "{editTarget.name}"</p>
            <div className="modal-row">
              <input type="number" min="0" value={editDays} onChange={(e) => setEditDays(parseInt(e.target.value, 10) || 0)} autoFocus />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setEditTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={submitEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Remove chore?</h2>
            <p>This removes "{deleteTarget.name}" from your chore tracker.</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>Keep it</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={confirmDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
