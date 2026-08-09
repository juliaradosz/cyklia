import { useEffect, useState } from "react";
import { api } from "./api/client.js";

export function useCalendar() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const res = await api("/calendar");
      setData(res);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return { data, error, loading, reload: () => setReloadKey((k) => k + 1) };
}

export async function addPeriod(start_date, end_date, flow_level = 1) {
  return api("/cycles", {
    method: "POST",
    body: { start_date, end_date, flow_level },
  });
}

export async function removePeriod(id) {
  return api(`/cycles/${id}`, { method: "DELETE" });
}
