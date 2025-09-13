"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Equipment, Event } from "@/lib/types";

export default function EquipmentDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const [eq, setEq] = useState<Equipment | null>(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [assign, setAssign] = useState<{ event_id: string; quantity: number }>({ event_id: "", quantity: 1 });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("equipments").select("*").eq("id", id).single();
      setEq((data as Equipment) || null);
      const { data: evs } = await supabase.from('events').select('*').order('start_at', { ascending: true });
      setEvents((evs || []) as Event[]);
    };
    if (id) load();
  }, [id]);

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eq) return;
    setBusy(true);
    const payload: Partial<Equipment> = {
      manufacturer: eq.manufacturer,
      model: eq.model,
      stock_count: eq.stock_count,
      url: eq.url || null,
      power_consumption: eq.power_consumption || null,
      weight: eq.weight || null,
      dimensions: eq.dimensions || null,
      unit_price: eq.unit_price ?? null,
      origin_country: eq.origin_country || null,
      notes: eq.notes || null
    } as any;
    await supabase.from("equipments").update(payload).eq("id", id);
    setBusy(false);
    router.push('/inventory');
  };

  const addToEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assign.event_id || !eq) return;
    const qty = Number(assign.quantity) || 1;
    // If usage exists, increment; otherwise insert
    const { data: existing } = await supabase
      .from('event_usages')
      .select('id,quantity')
      .eq('event_id', assign.event_id)
      .eq('equipment_id', eq.id)
      .single();
    if (existing && (existing as any).id) {
      const cur = (existing as any).quantity || 0;
      const { error } = await supabase
        .from('event_usages')
        .update({ quantity: cur + qty })
        .eq('id', (existing as any).id);
      if (error) alert(error.message); else alert('既存の割当数量に加算しました');
    } else {
      const { error } = await supabase.from('event_usages').insert({
        event_id: assign.event_id,
        equipment_id: eq.id,
        quantity: qty
      } as any);
      if (error) alert(error.message); else alert('イベントに割当を追加しました');
    }
  };

  if (!eq) return <div>読み込み中...</div>;

  return (
    <div className="stack">
      <h2 className="page-title">機材詳細</h2>
      <form onSubmit={update} className="form-grid" style={{ maxWidth: 560 }}>
        <input placeholder="メーカー(必須)" value={eq.manufacturer} onChange={e => setEq({ ...eq, manufacturer: e.target.value })} required />
        <input placeholder="型番(必須)" value={eq.model} onChange={e => setEq({ ...eq, model: e.target.value })} required />
        <input type="number" placeholder="在庫数(必須)" value={eq.stock_count} onChange={e => setEq({ ...eq, stock_count: Number(e.target.value) })} required />
        <input placeholder="URL" value={eq.url || ''} onChange={e => setEq({ ...eq, url: e.target.value })} />
        <input placeholder="消費電力" value={eq.power_consumption || ''} onChange={e => setEq({ ...eq, power_consumption: e.target.value })} />
        <input placeholder="重量" value={eq.weight || ''} onChange={e => setEq({ ...eq, weight: e.target.value })} />
        <input placeholder="サイズ" value={eq.dimensions || ''} onChange={e => setEq({ ...eq, dimensions: e.target.value })} />
        <input type="number" step="0.01" placeholder="単価" value={eq.unit_price ?? ''} onChange={e => setEq({ ...eq, unit_price: e.target.value === '' ? null : Number(e.target.value) })} />
        <input placeholder="原産国" value={eq.origin_country || ''} onChange={e => setEq({ ...eq, origin_country: e.target.value })} />
        <textarea placeholder="備考" value={eq.notes || ''} onChange={e => setEq({ ...eq, notes: e.target.value })} />
        <button className="btn primary" disabled={busy} type="submit">保存</button>
      </form>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="section-title">イベントに割当を追加</div>
        <form onSubmit={addToEvent} className="form-grid">
          <select value={assign.event_id} onChange={e => setAssign({ ...assign, event_id: e.target.value })}>
            <option value="">(イベントを選択)</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}（{new Date(ev.start_at).toLocaleDateString()} - {new Date(ev.end_at).toLocaleDateString()}）</option>
            ))}
          </select>
          <input type="number" min={1} value={assign.quantity} onChange={e => setAssign({ ...assign, quantity: Number(e.target.value) })} />
          <button className="btn primary" type="submit">追加</button>
        </form>
      </div>
    </div>
  );
}
