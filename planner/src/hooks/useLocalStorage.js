import { useState, useEffect, useRef } from 'react';

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const isFirst = useRef(true);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to save "${key}" to local storage:`, err);
      if (err && err.name === 'QuotaExceededError') {
        alert("This didn't save — your browser's local storage is full. Try a smaller image or clear some space.");
      }
    }
  }, [key, value]);

  return [value, setValue];
}
