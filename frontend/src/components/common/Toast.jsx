import { useEffect } from 'react';

export default function Toast({ message, onClose }) {
  const safeMessage =
    typeof message === 'string'
      ? message
      : message && typeof message === 'object'
        ? message.msg || JSON.stringify(message)
        : '';

  useEffect(() => {
    if (!safeMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [safeMessage, onClose]);

  if (!safeMessage) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <div className="flex items-start gap-3">
        <p className="flex-1">{safeMessage}</p>
        <button type="button" className="text-slate-300 hover:text-white" onClick={onClose}>
          x
        </button>
      </div>
    </div>
  );
}
