import { CATEGORIES } from '../data/categories';

export default function CategoryTag({ category }) {
  const meta = CATEGORIES[category] || CATEGORIES.personal;
  return (
    <span className="tag">
      <span className="tag-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
