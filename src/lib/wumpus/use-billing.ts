import { useEffect, useState } from "react";
import { getBilling, getMyBilling, type BillingSnapshot } from "./shardpay";

export function useBilling(privateAccount = false) {
  const [data, setData] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (privateAccount ? getMyBilling({ data: {} }) : getBilling())
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
  }, [privateAccount]);

  return { data, loading };
}
