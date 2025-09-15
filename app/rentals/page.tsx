"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Equipment, Rental, Category } from "@/lib/types";
import { useAdminMode } from "@/lib/useAdminMode";
import AdminPanel from "@/components/AdminPanel";

type Form = {
  equipment_id: string;
  quantity: number;
  company: string;
  arrive_at: string;
  return_at: string;
  arrive_place: string;
  return_place: string;
  notes: string;
};

export default function RentalsPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [form, setForm] = useState<Form>({ equipment_id: "", quantity: 1, company: "", arrive_at: "", return_at: "", arrive_place: "", return_place: "", notes: "" });
  const { admin } = useAdminMode();
  const [mode, setMode] = useState<'existing'|'new'>('existing');
  const [newEq, setNewEq] = useState({ category_id: "", new_category_name: "", manufacturer: "", model: "" });

  const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : "");
  const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : "");

  const reload = async () => {
    const [{ data: eqs }, { data: rts }, { data: cats }] = await Promise.all([
      supabase.from("equipments").select("*").order("manufacturer").order("model"),
      supabase.from("rentals").select("*").order("arrive_at", { ascending: true }),
      supabase.from("categories").select("*").order("name")
    ]);
    setEquipments((eqs || []) as Equipment[]);
    setRentals((rts || []) as Rental[]);
    setCategories((cats || []) as Category[]);
  };

  useEffect(() => { reload(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const arriveISO = dayStart(form.arrive_at);
    const returnISO = dayEnd(form.return_at);
    let equipmentId = form.equipment_id;
    if (mode === 'new') {
      // create category if needed
      let catId = newEq.category_id || "";
      if (!catId && newEq.new_category_name.trim()) {
        const { data: insertedCat } = await supabase.from('categories').insert({ name: newEq.new_category_name.trim() }).select('*').single();
        catId = (insertedCat as any)?.id || "";
      }
      // create equipment placeholder with stock_count 0 and is_rental_only
      let { data: newE, error: eqErr } = await supabase
        .from('equipments')
        .insert({
          category_id: catId || null,
          manufacturer: newEq.manufacturer,
          model: newEq.model,
          stock_count: 0,
          is_rental_only: true,
          properties: {}
        } as any)
        .select('*')
        .single();
      // 互換: is_rental_only列がない環境では、properties.rental_only=true で再試行
      if (eqErr && typeof eqErr.message === 'string' && eqErr.message.includes('is_rental_only')) {
        const retry = await supabase
          .from('equipments')
          .insert({
            category_id: catId || null,
            manufacturer: newEq.manufacturer,
            model: newEq.model,
            stock_count: 0,
            properties: { rental_only: true }
          } as any)
          .select('*')
          .single();
        newE = retry.data as any;
        eqErr = retry.error as any;
      }
      if (eqErr) { alert(eqErr.message); return; }
      equipmentId = (newE as any).id;
    }
    const payload = {
      equipment_id: equipmentId,
      quantity: Number(form.quantity) || 1,
      company: form.company,
      arrive_at: arriveISO,
      return_at: returnISO,
      arrive_place: form.arrive_place || null,
      return_place: form.return_place || null,
      notes: form.notes || null
    } as any;
    const { error } = await supabase.from("rentals").insert(payload);
    if (error) { alert(error.message); return; }
    setForm({ equipment_id: "", quantity: 1, company: "", arrive_at: "", return_at: "", arrive_place: "", return_place: "", notes: "" });
    setNewEq({ category_id: "", new_category_name: "", manufacturer: "", model: "" });
    await reload();
  };

  const eqName = (id: string) => {
    const e = equipments.find(x => x.id === id);
    return e ? `${e.manufacturer} ${e.model}` : id;
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">レンタル機材</h2>
        <AdminPanel />
      </div>

      <div className="card">
        <div className="section-title">レンタルを追加</div>
        <form onSubmit={add} className="form-grid" style={{ maxWidth: 720 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label><input type="radio" checked={mode==='existing'} onChange={() => setMode('existing')} /> 既存の機材をレンタル</label>
            <label><input type="radio" checked={mode==='new'} onChange={() => setMode('new')} /> 在庫にない機材をレンタル</label>
          </div>
          {mode === 'existing' ? (
            <>
              <label>
                カテゴリ
                <select value={(form as any).category_id || ''} onChange={e => setForm({ ...(form as any), category_id: e.target.value, equipment_id: '' }) as any}>
                  <option value="">(すべて)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <select value={form.equipment_id} onChange={e => setForm({ ...form, equipment_id: e.target.value })} required>
                <option value="">(機材を選択)</option>
                {equipments
                  .filter(eq => !(form as any).category_id || eq.category_id === (form as any).category_id)
                  .map(eq => <option key={eq.id} value={eq.id}>{eq.manufacturer} {eq.model}{(eq as any).is_rental_only ? '（レンタル）' : ''}</option>)}
              </select>
            </>
          ) : (
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                カテゴリ
                <select value={newEq.category_id} onChange={e => setNewEq({ ...newEq, category_id: e.target.value })}>
                  <option value="">(未選択)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <input placeholder="新規カテゴリ名（任意）" value={newEq.new_category_name} onChange={e => setNewEq({ ...newEq, new_category_name: e.target.value })} />
              <input placeholder="メーカー(必須)" value={newEq.manufacturer} onChange={e => setNewEq({ ...newEq, manufacturer: e.target.value })} required />
              <input placeholder="型番(必須)" value={newEq.model} onChange={e => setNewEq({ ...newEq, model: e.target.value })} required />
            </div>
          )}
          <input type="number" min={1} placeholder="レンタル台数" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} required />
          <input placeholder="レンタル先の会社" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} required />
          <label>
            到着日
            <input type="date" value={form.arrive_at} onChange={e => setForm({ ...form, arrive_at: e.target.value })} required />
          </label>
          <label>
            返却日
            <input type="date" value={form.return_at} onChange={e => setForm({ ...form, return_at: e.target.value })} required />
          </label>
          <input placeholder="到着場所" value={form.arrive_place} onChange={e => setForm({ ...form, arrive_place: e.target.value })} />
          <input placeholder="返却場所" value={form.return_place} onChange={e => setForm({ ...form, return_place: e.target.value })} />
          <textarea placeholder="備考" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button className="btn primary" type="submit">追加</button>
        </form>
      </div>

      <div className="list">
        {rentals.map(r => (
          <RentalCard key={r.id} rental={r} eqLabel={eqName(r.equipment_id)} canEdit={true} onChanged={reload} />
        ))}
      </div>
    </div>
  );
}

function RentalCard({ rental, eqLabel, canEdit, onChanged }: { rental: Rental; eqLabel: string; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    quantity: rental.quantity,
    company: rental.company,
    arrive_at: rental.arrive_at.slice(0, 10),
    return_at: rental.return_at.slice(0, 10),
    arrive_place: rental.arrive_place || "",
    return_place: rental.return_place || "",
    notes: rental.notes || "",
    arranged: !!rental.arranged
  });

  const dayStart = (d: string) => new Date(`${d}T00:00:00`).toISOString();
  const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`).toISOString();

  const save = async () => {
    const start = dayStart(f.arrive_at);
    const end = dayEnd(f.return_at);
    const { error } = await supabase
      .from('rentals')
      .update({
        quantity: Number(f.quantity) || 1,
        company: f.company,
        arrive_at: start,
        return_at: end,
        arrive_place: f.arrive_place || null,
        return_place: f.return_place || null,
        notes: f.notes || null,
        arranged: !!f.arranged
      })
      .eq('id', rental.id);
    if (error) {
      const msg = typeof error.message === 'string' && error.message.includes('arranged')
        ? '手配フラグ用の列(arranged)がまだDBにありません。supabase/sql/007_rentals_arranged.sql を実行し、schema をリロードしてください。'
        : error.message;
      alert(msg);
      return;
    }
    setEditing(false);
    onChanged();
  };

  const delIt = async () => {
    if (!confirm('このレンタルを削除しますか？')) return;
    const { error } = await supabase.from('rentals').delete().eq('id', rental.id);
    if (error) { alert(error.message); return; }
    onChanged();
  };

  return (
    <div className="card">
      {!editing ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><b>機材:</b> {eqLabel} <span className="tag">{rental.quantity} 台</span></div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setEditing(true)}>編集</button>
                <button className="btn danger" onClick={delIt}>削除</button>
              </div>
            )}
          </div>
          <div className="subtle"><b>会社:</b> {rental.company}</div>
          <div className="subtle"><b>期間:</b> {new Date(rental.arrive_at).toLocaleDateString()} - {new Date(rental.return_at).toLocaleDateString()}</div>
          <div className="subtle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              手配:
              <input
                style={{ margin: 0 }}
                type="checkbox"
                checked={!!rental.arranged}
                onChange={async (e) => {
                  const { error } = await supabase
                    .from('rentals')
                    .update({ arranged: e.target.checked })
                    .eq('id', rental.id);
                  if (error) {
                    const msg = typeof error.message === 'string' && error.message.includes('arranged')
                      ? '手配フラグ用の列(arranged)がまだDBにありません。supabase/sql/007_rentals_arranged.sql を実行し、schema をリロードしてください。'
                      : error.message;
                    alert(msg);
                    return;
                  }
                  onChanged();
                }}
              />
            </label>
            <span className={`pill ${rental.arranged ? 'ok' : 'danger'}`}>
              {rental.arranged ? '手配済' : '未手配'}
            </span>
          </div>
          {(rental.arrive_place || rental.return_place) && (
            <div className="subtle"><b>場所:</b> {rental.arrive_place || ''} → {rental.return_place || ''}</div>
          )}
        </>
      ) : (
        <div className="form-grid">
          <input type="number" min={1} value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value) })} />
          <input value={f.company} onChange={e => setF({ ...f, company: e.target.value })} />
          <label>
            到着日
            <input type="date" value={f.arrive_at} onChange={e => setF({ ...f, arrive_at: e.target.value })} />
          </label>
          <label>
            返却日
            <input type="date" value={f.return_at} onChange={e => setF({ ...f, return_at: e.target.value })} />
          </label>
          <input placeholder="到着場所" value={f.arrive_place} onChange={e => setF({ ...f, arrive_place: e.target.value })} />
          <input placeholder="返却場所" value={f.return_place} onChange={e => setF({ ...f, return_place: e.target.value })} />
          <textarea placeholder="備考" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={!!f.arranged} onChange={e => setF({ ...f, arranged: e.target.checked })} /> 手配済み
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={save}>保存</button>
            <button className="btn" onClick={() => setEditing(false)}>キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}
