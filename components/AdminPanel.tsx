"use client";

import { useState } from "react";
import { useAdminMode } from "@/lib/useAdminMode";

export default function AdminPanel() {
  const { admin, enter, exit } = useAdminMode();
  const [pw, setPw] = useState("");

  const boxStyle: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', padding: 4, fontSize: 12 };
  if (admin) {
    return (
      <div className="card" style={boxStyle}>
        <span>管理者モード</span>
        <button className="btn" style={{ padding: '2px 6px' }} onClick={exit}>解除</button>
      </div>
    );
  }

  return (
    <form className="card" style={boxStyle}
      onSubmit={e => { e.preventDefault(); if (!enter(pw)) alert('パスワードが違います'); }}>
      <span className="subtle">管理:</span>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={{ maxWidth: 120 }} />
      <button className="btn" style={{ padding: '2px 6px' }} type="submit">ON</button>
    </form>
  );
}
