import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';

export default function ActionMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className="dots-btn"
        aria-label="Options"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <MoreVertical size={15} />
      </button>
      <div className={`dropdown ${open ? 'show' : ''}`}>
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil size={13} /> Edit
          </button>
        )}
        {onDelete && (
          <button
            className="danger"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
