"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Event, EventUsage, Equipment } from "@/lib/types";
import Link from "next/link";

export default function UsagesPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [usages, setUsages] = useState<EventUsage[]>([]);
  const [equipments, setEquipments] = useState<Map<string, Equipment>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data: evs } = await supabase.from('events').select('*').order('start_at', { ascending: true });
      const evList = (evs || []) as Event[];
      const evIds = evList.map(e => e.id);
      const { data: us } = await supabase.from('event_usages').select('*').in('event_id', evIds);
      const usageList = (us || []) as EventUsage[];
      const eqIds = Array.from(new Set(usageList.map(u => u.equipment_id)));
      const { data: eqs } = eqIds.length > 0
        ? await supabase.from('equipments').select('*').in('id', eqIds)
        : { data: [] } as any;
      const eqMap = new Map<string, Equipment>();
      for (const e of (eqs || []) as Equipment[]) eqMap.set(e.id, e);
      setEvents(evList);
      setUsages(usageList);
      setEquipments(eqMap);
      setLoading(false);
    };
    run();
  }, []);

  const pastel = (key: string) => {
    if (!key) return { bg: '#fff', border: '#e5e7eb' };
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const bg = `hsla(${hue}, 80%, 95%, 1)`;
    const border = `hsla(${hue}, 70%, 85%, 1)`;
    return { bg, border };
  };

  const byEvent = new Map<string, EventUsage[]>();
  for (const u of usages) {
    const arr = byEvent.get(u.event_id) || [];
    arr.push(u);
    byEvent.set(u.event_id, arr);
  }

  return (
    <div className="stack">
      <h2 className="page-title">使用機材一覧</h2>
      {loading && <div className="card">読み込み中...</div>}
      {!loading && events.length === 0 && <div className="card">イベントがありません。</div>}
      {!loading && events.length > 0 && (
        <div className="list">
          {events.map(ev => (
            <div key={ev.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700 }}><Link href={`/events/${ev.id}`}>{ev.name}</Link></div>
                <div className="subtle">{new Date(ev.start_at).toLocaleDateString()} - {new Date(ev.end_at).toLocaleDateString()}</div>
              </div>
              <div className="subtle">{ev.location || ''}</div>
              <div className="divider" />
              {(byEvent.get(ev.id) || []).length === 0 ? (
                <div className="subtle">機材割当はありません</div>
              ) : (
                <div className="list">
                  {(byEvent.get(ev.id) || []).map((u, i) => {
                    const eq = equipments.get(u.equipment_id);
                    const colors = pastel(eq?.category_id || eq?.manufacturer || '');
                    return (
                      <div key={i} className="card" style={{ background: colors.bg, borderColor: colors.border, padding: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <div>{eq ? `${eq.manufacturer} ${eq.model}` : u.equipment_id}</div>
                        <div><span className="tag">{u.quantity} 台</span></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
