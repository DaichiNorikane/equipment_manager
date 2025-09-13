"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", location: "", start_at: "", end_at: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : "");
  const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : "");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('events').insert({
      name: form.name,
      location: form.location || null,
      start_at: dayStart(form.start_at),
      end_at: dayEnd(form.end_at),
      notes: form.notes || null
    } as any);
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.push('/events');
  };

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <h2 className="page-title">イベントを追加</h2>
      <form onSubmit={add} className="form-grid">
        <input placeholder="イベント名(必須)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="場所" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
        <label>
          開始日
          <input type="date" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} required />
        </label>
        <label>
          終了日
          <input type="date" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} required />
        </label>
        <textarea placeholder="備考" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <div>
          <button disabled={busy} className="btn primary" type="submit">追加</button>
          <button type="button" className="btn" onClick={() => router.push('/events')} style={{ marginLeft: 8 }}>キャンセル</button>
        </div>
      </form>
    </div>
  );
}

