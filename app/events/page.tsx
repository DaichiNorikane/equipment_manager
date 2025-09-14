"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Event, Equipment, EventUsage, Category } from "@/lib/types";
import Link from "next/link";
import AdminPanel from "@/components/AdminPanel";
import { useAdminMode } from "@/lib/useAdminMode";

type EventForm = {
  name: string;
  location: string;
  start_at: string;
  end_at: string;
  notes: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [usages, setUsages] = useState<{ category_id: string; equipment_id: string; quantity: number }[]>([]);
  const [form, setForm] = useState<EventForm>({ name: "", location: "", start_at: "", end_at: "", notes: "" });
  const [shortages, setShortages] = useState<{ equipment_id: string; wanted: number; available: number }[]>([]);
  const { admin } = useAdminMode();

  const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : "");
  const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : "");

  const reload = async () => {
    const { data: evs } = await supabase.from("events").select("*").order("start_at", { ascending: false });
    setEvents((evs || []) as Event[]);
  };

  useEffect(() => {
    const init = async () => {
      await reload();
      const { data: cats } = await supabase.from("categories").select("*").order('sort_order', { ascending: true }).order("name");
      setCategories((cats || []) as Category[]);
      const { data: eqs } = await supabase.from("equipments").select("*").order("manufacturer").order("model");
      setEquipments((eqs || []) as Equipment[]);
    };
    init();
  }, []);

  const checkShortage = async () => {
    setShortages([]);
    if (!form.start_at || !form.end_at) return;
    const start = dayStart(form.start_at);
    const end = dayEnd(form.end_at);
    const list: { equipment_id: string; wanted: number; available: number }[] = [];
    for (const u of usages) {
      const { data: available } = await supabase.rpc("available_units", {
        p_equipment_id: u.equipment_id,
        p_start: start,
        p_end: end
      });
      const availNum = typeof available === "number" ? available : 0;
      list.push({ equipment_id: u.equipment_id, wanted: u.quantity, available: availNum });
    }
    setShortages(list);
  };

  useEffect(() => {
    checkShortage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.start_at, form.end_at, JSON.stringify(usages)]);

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = dayStart(form.start_at);
    const end = dayEnd(form.end_at);
    // Create event
    const { data: inserted, error } = await supabase
      .from("events")
      .insert({
        name: form.name,
        location: form.location || null,
        start_at: start,
        end_at: end,
        notes: form.notes || null
      })
      .select("*")
      .single();
    if (error || !inserted) return;

    // Insert usages (dedupe: 同じ機材は数量を合算して1行に)
    const grouped = new Map<string, number>();
    for (const u of usages) {
      if (!u.equipment_id || u.quantity <= 0) continue;
      grouped.set(u.equipment_id, (grouped.get(u.equipment_id) || 0) + u.quantity);
    }
    const rows = Array.from(grouped.entries()).map(([equipment_id, quantity]) => ({
      event_id: inserted.id,
      equipment_id,
      quantity
    }));
    if (rows.length > 0) {
      await supabase.from("event_usages").insert(rows);
    }

    // reset
    setForm({ name: "", location: "", start_at: "", end_at: "", notes: "" });
    setUsages([]);
    setShortages([]);
    await reload();
  };

  const addUsageRow = () => setUsages(prev => [...prev, { category_id: "", equipment_id: "", quantity: 1 }]);
  const updateUsage = (idx: number, patch: Partial<{ category_id: string; equipment_id: string; quantity: number }>) =>
    setUsages(prev => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  const removeUsage = (idx: number) => setUsages(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">イベント</h2>
        <AdminPanel />
      </div>

      {/* イベント追加フォームは別ページへ移動 */}

      <div className="list">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>イベント一覧</span>
          <Link className="btn primary" href="/events/new">イベント追加</Link>
        </div>
        {events.map(ev => (
          <div key={ev.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>
                <Link href={`/events/${ev.id}`}>{ev.name}</Link>
              </div>
              {admin && (
                <button className="btn danger" onClick={async () => {
                  if (!confirm(`イベント「${ev.name}」を削除しますか？`)) return;
                  const { error } = await supabase.from('events').delete().eq('id', ev.id);
                  if (error) alert(error.message); else await reload();
                }}>削除</button>
              )}
            </div>
            <div className="subtle">{ev.location || ''}</div>
            <div className="subtle">{new Date(ev.start_at).toLocaleDateString()} - {new Date(ev.end_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
