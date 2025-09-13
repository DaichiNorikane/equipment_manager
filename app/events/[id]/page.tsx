"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Equipment, Event, EventUsage, Category } from "@/lib/types";

type UsageRow = { id?: string; category_id: string; equipment_id: string; quantity: number; notes?: string };

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sortMode, setSortMode] = useState<"default" | "category" | "manufacturer">("default");

  const pastel = (key: string) => {
    if (!key) return { bg: '#fff', border: '#e5e7eb' };
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const bg = `hsla(${hue}, 80%, 95%, 1)`;
    const border = `hsla(${hue}, 70%, 85%, 1)`;
    return { bg, border };
  };

  useEffect(() => {
    const load = async () => {
      // Load event
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      setEvent((ev as Event) || null);

      // Load categories and equipments for selection
      const [{ data: cats }, { data: eqs }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("equipments").select("*").order("manufacturer").order("model")
      ]);
      const eqList = (eqs || []) as Equipment[];
      setCategories((cats || []) as Category[]);
      setEquipments(eqList);

      // Load current usages
      const { data: us } = await supabase
        .from("event_usages")
        .select("id,equipment_id,quantity,notes")
        .eq("event_id", id)
        .order("created_at", { ascending: true });
      const urows = (us || []) as Pick<EventUsage, "id" | "equipment_id" | "quantity" | "notes">[];
      setRows(
        urows.map(u => ({
          id: u.id,
          equipment_id: u.equipment_id,
          quantity: u.quantity,
          notes: u.notes || "",
          category_id: eqList.find(e => e.id === u.equipment_id)?.category_id || ""
        }))
      );
      setInitialIds(urows.map(u => u.id));
    };
    if (id) load();
  }, [id]);

  const addRow = () => setRows(prev => [...prev, { category_id: "", equipment_id: "", quantity: 1 }]);
  const updateRow = (idx: number, patch: Partial<UsageRow>) =>
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setBusy(true);

    // 1) Deleted rows (missing IDs)
    const currentIds = rows.filter(r => r.id).map(r => r.id!);
    const toDeleteMissing = initialIds.filter(id0 => !currentIds.includes(id0));

    // 2) Group by equipment to avoid duplicates: sum quantities, keep first existing id
    const groups = new Map<string, { total: number; keepId?: string; deleteIds: string[]; needsInsert: boolean; note?: string }>();
    for (const r of rows) {
      if (!r.equipment_id || r.quantity <= 0) continue;
      if (!groups.has(r.equipment_id)) groups.set(r.equipment_id, { total: 0, deleteIds: [], needsInsert: true });
      const g = groups.get(r.equipment_id)!;
      g.total += r.quantity;
      if (!g.note && r.notes && r.notes.trim()) g.note = r.notes.trim();
      if (r.id) {
        if (!g.keepId) g.keepId = r.id;
        else g.deleteIds.push(r.id);
        g.needsInsert = false; // there is at least one existing row
      }
    }

    // Perform deletes (removed rows + duplicate rows)
    const dupDelete = Array.from(groups.values()).flatMap(g => g.deleteIds);
    const allDeletes = [...toDeleteMissing, ...dupDelete];
    if (allDeletes.length > 0) {
      await supabase.from("event_usages").delete().in("id", allDeletes);
    }

    // Updates/Inserts
    for (const [equipment_id, g] of groups.entries()) {
      if (g.keepId) {
        await supabase.from("event_usages").update({ equipment_id, quantity: g.total, notes: g.note ?? null }).eq("id", g.keepId);
      } else if (g.needsInsert) {
        await supabase.from("event_usages").insert({ event_id: event.id, equipment_id, quantity: g.total, notes: g.note ?? null } as any);
      }
    }

    // Reload state
    const { data: us2 } = await supabase
      .from("event_usages")
      .select("id,equipment_id,quantity,notes")
      .eq("event_id", id)
      .order("created_at", { ascending: true });
    const urows2 = (us2 || []) as Pick<EventUsage, "id" | "equipment_id" | "quantity" | "notes">[];
    setRows(urows2.map(u => ({ id: u.id, equipment_id: u.equipment_id, quantity: u.quantity, notes: u.notes || "", category_id: (equipments.find(e => e.id === u.equipment_id)?.category_id) || "" })));
    setInitialIds(urows2.map(u => u.id));

    setBusy(false);
    alert("保存しました");
  };

  const exportCsv = () => {
    if (!event) return;
    const header = [
      'イベント名','場所','開始日','終了日',
      '機材ID','メーカー','型番','カテゴリ','数量','備考',
      'URL','消費電力','サイズ','単価','原産国','機材備考'
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const eq = equipments.find(e => e.id === r.equipment_id);
      const cat = categories.find(c => c.id === (eq?.category_id || ''))?.name || '';
      const vals = [
        event.name,
        event.location || '',
        new Date(event.start_at).toLocaleDateString(),
        new Date(event.end_at).toLocaleDateString(),
        r.equipment_id,
        eq?.manufacturer || '',
        eq?.model || '',
        cat,
        String(r.quantity),
        (r.notes || '').replaceAll('\n',' ').replaceAll(',',' '),
        eq?.url || '',
        eq?.power_consumption || '',
        eq?.dimensions || '',
        (eq?.unit_price ?? '').toString(),
        eq?.origin_country || '',
        (eq?.notes || '').replaceAll('\n',' ').replaceAll(',',' ')
      ];
      const esc = (s: string) => (/[,"\n]/.test(s) ? '"' + s.replaceAll('"','""') + '"' : s);
      lines.push(vals.map(v => esc(String(v))).join(','));
    }
    // Excel 文字化け回避: UTF-8 BOM を付与
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csv = lines.join('\n');
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.name}_equipments.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!event) return <div>読み込み中...</div>;

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 className="page-title">イベント機材編集</h2>
        <Link className="btn" href="/events">一覧に戻る</Link>
      </div>

      <div className="card subtle">
        <div><b>イベント:</b> {event.name}</div>
        <div><b>場所:</b> {event.location || ''}</div>
        <div><b>期間:</b> {new Date(event.start_at).toLocaleDateString()} - {new Date(event.end_at).toLocaleDateString()}</div>
        {event.notes ? <div><b>備考:</b> {event.notes}</div> : null}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className="btn" onClick={() => exportCsv()}>CSVダウンロード</button>
      </div>

      <form onSubmit={save} className="form-grid" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>機材割当</b>
          <button className="btn" type="button" onClick={addRow}>行を追加</button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label>
            並び替え
            <select value={sortMode} onChange={e => setSortMode(e.target.value as any)}>
              <option value="default">追加順</option>
              <option value="category">カテゴリ別</option>
              <option value="manufacturer">メーカー別</option>
            </select>
          </label>
        </div>
        {(rows.slice().sort((a, b) => {
          if (sortMode === 'category') {
            const ca = equipments.find(e => e.id === a.equipment_id)?.category_id || '';
            const cb = equipments.find(e => e.id === b.equipment_id)?.category_id || '';
            return ca.localeCompare(cb) || a.equipment_id.localeCompare(b.equipment_id);
          }
          if (sortMode === 'manufacturer') {
            const ma = equipments.find(e => e.id === a.equipment_id)?.manufacturer || '';
            const mb = equipments.find(e => e.id === b.equipment_id)?.manufacturer || '';
            return ma.localeCompare(mb) || a.equipment_id.localeCompare(b.equipment_id);
          }
          return 0;
        })).map((r, idx) => {
          const filtered = r.category_id ? equipments.filter(eq => eq.category_id === r.category_id) : equipments;
          const selectedIds = rows.map(x => x.equipment_id).filter(Boolean);
          const colors = pastel(r.category_id || (equipments.find(e => e.id === r.equipment_id)?.manufacturer || ''));
          return (
            <div key={r.id ?? `new-${idx}`} className="row event-row" style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 8,
                alignItems: 'center'
              }}>
                <select
                  value={r.category_id}
                  onChange={e => updateRow(idx, { category_id: e.target.value, equipment_id: "" })}
                >
                  <option value="">(カテゴリ未選択)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select style={{ width: 'auto', maxWidth: '100%' }} value={r.equipment_id} onChange={e => {
                  const val = e.target.value;
                  if (val && selectedIds.includes(val) && val !== r.equipment_id) {
                    alert('同じ機材は1行にまとめて数量で調整してください。');
                    return;
                  }
                  updateRow(idx, { equipment_id: val });
                }}>
                  <option value="">(機材を選択)</option>
                  {filtered
                    .filter(eq => eq.id === r.equipment_id || !selectedIds.includes(eq.id))
                    .map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.manufacturer} {eq.model}</option>
                    ))}
                </select>
                <input style={{ width: 70 }} type="number" min={1} value={r.quantity} onChange={e => updateRow(idx, { quantity: Number(e.target.value) })} />
                <input placeholder="備考" value={r.notes || ''} onChange={e => updateRow(idx, { notes: e.target.value })} />
                <button className="btn delete-btn" type="button" onClick={() => removeRow(idx)}>削除</button>
                {(() => {
                  const eq = equipments.find(e => e.id === r.equipment_id);
                  if (!eq) return null;
                  const isRental = (eq as any).is_rental_only === true || (((eq as any).properties || {})['rental_only'] === true);
                  const hasInfo = isRental || !!eq.power_consumption;
                  if (!hasInfo) return null;
                  return (
                    <div className="subtle" style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                      消費電力: {eq.power_consumption || '-'}
                      {isRental && (
                        <>
                          {' '}| <Link href="/rentals">レンタル</Link>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
          );
        })}
        <div>
          <button className="btn primary" disabled={busy} type="submit">保存</button>
        </div>
      </form>
    </div>
  );
}
