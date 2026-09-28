import { useEffect, useState } from "react";
import { getBilling, type BillingSnapshot } from "./shardpay.server";

export function useBilling() {
  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getBilling()
      .then((snapshot) => {
        if (!alive) return;
        if (snapshot && typeof snapshot === "object" && Array.isArray(snapshot.plans)) setData(snapshot);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading };
}
