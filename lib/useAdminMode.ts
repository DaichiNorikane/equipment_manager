"use client";

import { useEffect, useState } from "react";

export function useAdminMode() {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = localStorage.getItem('adminMode');
    setAdmin(v === 'true');
  }, []);

  const enter = (password: string) => {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin";
    const ok = password === expected;
    if (ok && typeof window !== 'undefined') {
      localStorage.setItem('adminMode', 'true');
      setAdmin(true);
    }
    return ok;
  };

  const exit = () => {
    if (typeof window !== 'undefined') localStorage.removeItem('adminMode');
    setAdmin(false);
  };

  return { admin, enter, exit };
}

