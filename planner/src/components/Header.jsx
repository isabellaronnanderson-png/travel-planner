import { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, X, Move, Pencil } from 'lucide-react';

export const TAB_META = {
  habits: 'Today',
  todo: 'To-do',
  chores: 'Chores',
  schedule: 'Schedule',
  insights: 'Insights',
};

export default function Header({
  coverImage, setCoverImage,
  coverPosition, setCoverPosition,
  activeTab, setActiveTab,
  tabOrder, setTabOrder,
  currentDate,
  title, setTitle,
}) {
  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const titleInputRef = useRef(null);
  const [dragTabId, setDragTabId] = useState(null);
  const [dragOverTabId, setDragOverTabId] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  function startEditingTitle() {
    setDraftTitle(title);
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  function commitTitle() {
    const trimmed = draftTitle.trim();
    setTitle(trimmed || title);
    setIsEditingTitle(false);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Keep shrinking quality if it's still large, so it reliably fits in localStorage.
        while (dataUrl.length > 1_800_000 && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        setCoverImage(dataUrl);
        setCoverPosition({ x: 50, y: 50 });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function startCoverDrag(e) {
    e.preventDefault();
    const rect = coverRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...coverPosition };

    function onMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const nextX = Math.max(0, Math.min(100, startPos.x - (deltaX / rect.width) * 100));
      const nextY = Math.max(0, Math.min(100, startPos.y - (deltaY / rect.height) * 100));
      setCoverPosition({ x: nextX, y: nextY });
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function dropTab(targetId) {
    if (!dragTabId || dragTabId === targetId) {
      setDragTabId(null);
      setDragOverTabId(null);
      return;
    }
    const order = [...tabOrder];
    const fromIdx = order.indexOf(dragTabId);
    const toIdx = order.indexOf(targetId);
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, dragTabId);
    setTabOrder(order);
    setDragTabId(null);
    setDragOverTabId(null);
  }

  const today = new Date(currentDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="cover" ref={coverRef}>
        {coverImage ? (
          <>
            <img
              src={coverImage}
              alt=""
              style={{ objectPosition: `${coverPosition.x}% ${coverPosition.y}%` }}
              onMouseDown={startCoverDrag}
              draggable={false}
            />
            <span className="cover-reposition-hint"><Move size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Drag to reposition</span>
          </>
        ) : (
          <button className="cover-empty" onClick={() => fileRef.current.click()}>
            <ImagePlus size={16} /> Add a cover photo
          </button>
        )}
        {coverImage && (
          <div className="cover-controls">
            <button className="cover-btn" onClick={() => fileRef.current.click()}><RefreshCw size={12} /> Change</button>
            <button className="cover-btn" onClick={() => setCoverImage(null)}><X size={12} /> Remove</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      <div className="header-block">
        <div className="header-title-row title-group">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className="title-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
                if (e.key === 'Escape') { e.preventDefault(); setIsEditingTitle(false); }
              }}
            />
          ) : (
            <>
              <h1 className="header-title">{title}</h1>
              <button className="title-edit-btn" onClick={startEditingTitle} aria-label="Edit title">
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>
        <p className="header-date">{today}</p>
      </div>

      <nav className="tabs">
        {tabOrder.map((key) => (
          <button
            key={key}
            className={`tab ${activeTab === key ? 'active' : ''} ${dragOverTabId === key ? 'tab-drag-over' : ''}`}
            draggable
            onClick={() => setActiveTab(key)}
            onDragStart={() => setDragTabId(key)}
            onDragOver={(e) => { e.preventDefault(); setDragOverTabId(key); }}
            onDragLeave={() => setDragOverTabId(null)}
            onDrop={() => dropTab(key)}
          >
            {TAB_META[key]}
          </button>
        ))}
      </nav>
    </>
  );
}
