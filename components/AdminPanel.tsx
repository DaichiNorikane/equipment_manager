"use client";

import { useState } from "react";
import { useAdminMode } from "@/lib/useAdminMode";

export default function AdminPanel() {
  const { admin, enter, exit } = useAdminMode();
  const [pw, setPw] = useState("");

  if (admin) {
    return (
      <div className="card" style={{ padding: 8 }}>
        <b>管理者モード: ON</b>
        <div><button className="btn" onClick={exit}>解除</button></div>
      </div>
    );
  }

  return (
    <form className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8 }}
      onSubmit={e => { e.preventDefault(); if (!enter(pw)) alert('パスワードが違います'); }}>
      <span className="subtle">管理者パスワード:</span>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} />
      <button className="btn" type="submit">管理者モードに入る</button>
    </form>
  );
}
