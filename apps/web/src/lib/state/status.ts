import { useCallback, useState } from "react";

/**
 * One error / notice banner shared by the parser and the notes import-export,
 * so the splash and header never disagree about what just happened.
 */
export function useStatus() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clear = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  return { error, setError, notice, setNotice, clear };
}

export type Status = ReturnType<typeof useStatus>;
