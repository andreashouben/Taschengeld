import { useState, useEffect, useRef } from "react";

interface Props {
  onConfirm: () => void;
}

export function DeleteButton({ onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleFirstClick() {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 3000);
  }

  function handleCancel() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
  }

  function handleConfirm() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onConfirm();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Abbrechen"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-1"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          aria-label="Löschen bestätigen"
          className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors animate-pulse"
        >
          Löschen?
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleFirstClick}
      aria-label="Buchung löschen"
      title="Buchung löschen"
      className="text-red-300 dark:text-red-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
      </svg>
    </button>
  );
}
