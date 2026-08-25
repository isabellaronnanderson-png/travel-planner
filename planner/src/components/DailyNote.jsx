import { useState, useRef } from 'react';
import { Pencil, ImagePlus, X, Check } from 'lucide-react';

export default function DailyNote({ text, setText, image, setImage }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text || '');
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1000;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 900_000 && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        setImage(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function startEdit() {
    setDraft(text || '');
    setEditing(true);
  }
  function commit() {
    setText(draft);
    setEditing(false);
  }

  const isEmpty = !text && !image;

  if (!editing && isEmpty) {
    return (
      <button className="daily-note-empty" onClick={startEdit}>
        + Add a daily note or photo
      </button>
    );
  }

  if (!editing) {
    return (
      <div className="daily-note">
        {image && <img src={image} alt="" className="daily-note-img" />}
        {text && <p className="daily-note-text">{text}</p>}
        <button className="daily-note-edit-btn" onClick={startEdit} aria-label="Edit note">
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="daily-note daily-note-editing">
      {image && (
        <div className="daily-note-img-wrap">
          <img src={image} alt="" className="daily-note-img" />
          <button className="cover-btn daily-note-remove-img" onClick={() => setImage(null)}>
            <X size={12} /> Remove photo
          </button>
        </div>
      )}
      <textarea
        className="scratchpad-textarea"
        placeholder="A quote, intention, or note for today..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <div className="daily-note-actions">
        <button type="button" className="btn btn-sm" onClick={() => fileRef.current.click()}>
          <ImagePlus size={12} /> {image ? 'Change photo' : 'Add photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={commit}>
          <Check size={12} /> Done
        </button>
      </div>
    </div>
  );
}
