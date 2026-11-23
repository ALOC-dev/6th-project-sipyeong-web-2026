"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, requiresLogin } from "./api-client";

type LoadState<T> = { data?: T; error?: string };

export function useApi<T>(load: (signal: AbortSignal) => Promise<T>) {
  const router = useRouter();
  const [state, setState] = useState<LoadState<T>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (requiresLogin(error)) {
        router.replace("/login?reason=session");
        return;
      }
      setState({ error: errorMessage(error) });
    });
    return () => controller.abort();
  }, [load, router, attempt]);

  function reload() {
    setState({});
    setAttempt((previous) => previous + 1);
  }

  return { ...state, reload };
}
