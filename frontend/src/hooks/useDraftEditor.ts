import { useEffect, useMemo, useState } from "react";

function serializeValue<T>(value: T | null) {
  return value ? JSON.stringify(value) : "";
}

export function useDraftEditor<T>(value: T | null) {
  const [draft, setDraft] = useState<T | null>(value);
  const serializedOriginal = useMemo(() => serializeValue(value), [value]);
  const serializedDraft = useMemo(() => serializeValue(draft), [draft]);

  useEffect(() => {
    setDraft(value);
  }, [serializedOriginal, value]);

  return {
    draft,
    setDraft,
    dirty: serializedDraft !== serializedOriginal,
    reset: () => setDraft(value),
  };
}
