import { useCallback, useEffect, useState } from "react";
import { listUrls } from "../api/urls";

// SERVER STATE: data that lives on the server and that this page only borrows.
// Unlike ordinary UI state (is a menu open?) it can be loading, fail, and be out
// of date the moment it arrives. This hook gives the page those four facts:
//
//   data     the last page we successfully received (kept while a new one loads,
//            so the table doesn't flash empty between pages)
//   loading  a request is in flight
//   error    the last request failed (an Error with .message, .code, .requestId)
//   reload   fetch the same page again (after an edit or delete)
export function useLinks(params) {
  // The outcome of the most recent request that FINISHED, and which request that was.
  const [result, setResult] = useState({ requestKey: null, data: null, error: null });
  const [reloadCount, setReloadCount] = useState(0);

  // One identity for "this exact request": same parameters, same reload round.
  // (We compare the CONTENT of the parameters, not the identity of the object.)
  const key = JSON.stringify(params);
  const requestKey = `${key}#${reloadCount}`;

  useEffect(() => {
    const controller = new AbortController();

    listUrls(JSON.parse(key), { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return; // superseded while in flight: never let a stale answer through
        setResult({ requestKey, data, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted || error.code === "ERR_CANCELED") return; // a newer request took over
        setResult((previous) => ({ requestKey, data: previous.data, error })); // keep the last good page
      });

    return () => controller.abort();
  }, [key, requestKey]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const current = result.requestKey === requestKey;
  return { data: result.data, loading: !current, error: current ? result.error : null, reload };
}
