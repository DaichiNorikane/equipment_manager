"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Category, Equipment } from "@/lib/types";

export default function InventoryAddPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  // Section A: existing equipment stock increment
  const [selManufacturer, setSelManufacturer] = useState("");
  const [selCategory, setSelCategory] = useState("");
  const [selEquipment, setSelEquipment] = useState("");
  const [incQty, setIncQty] = useState(1);

  // Section B: new equipment creation
  const [newForm, setNewForm] = useState({ category_id: "", manufacturer: "", model: "", stock_count: 0, notes: "" });
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    const init = async () => {
      const [{ data: cats }, { data: eqs }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("equipments").select("*").order("manufacturer").order("model")
      ]);
      setCategories((cats || []) as Category[]);
      setEquipments((eqs || []) as Equipment[]);
    };
    init();
  }, []);

  const manufacturers = useMemo(() => Array.from(new Set(equipments.map(e => e.manufacturer))).sort(), [equipments]);
  const filteredByManu = useMemo(() => selManufacturer ? equipments.filter(e => e.manufacturer === selManufacturer) : equipments, [equipments, selManufacturer]);
  const filteredEquipments = useMemo(
    () => filteredByManu.filter(e => (selCategory ? e.category_id === selCategory : true)),
    [filteredByManu, selCategory]
  );

  const addStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selEquipment || incQty <= 0) return;
    const { data: cur } = await supabase.from("equipments").select("id,stock_count").eq("id", selEquipment).single();
    const current = (cur as any)?.stock_count ?? 0;
    const next = current + incQty;
    const { error } = await supabase.from("equipments").update({ stock_count: next }).eq("id", selEquipment);
    if (error) alert(`在庫追加に失敗しました: ${error.message}`);
    else alert("在庫を追加しました");
  };

  const createNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      category_id: newForm.category_id || null,
      manufacturer: newForm.manufacturer,
      model: newForm.model,
      stock_count: Number(newForm.stock_count) || 0,
      notes: newForm.notes || null,
      properties: {}
    };
    let { error } = await supabase.from("equipments").insert(payload);
    if (error && typeof error.message === 'string' && error.message.includes('column "name"')) {
      const legacyPayload = { ...payload, name: `${newForm.manufacturer} ${newForm.model}`.trim() } as any;
      const retry = await supabase.from("equipments").insert(legacyPayload);
      error = retry.error || null;
    }
    if (error) alert(`機材の追加に失敗しました: ${error.message}`);
    else alert("機材を追加しました");
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    const { data, error } = await supabase.from('categories').insert({ name }).select('*').single();
    if (error) { alert(error.message); return; }
    setNewCat("");
    const { data: cats } = await supabase.from('categories').select('*').order('name');
    setCategories((cats || []) as Category[]);
    if (data?.id) setNewForm(prev => ({ ...prev, category_id: (data as any).id }));
  };

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 className="page-title">機材の追加/在庫追加</h2>
        <Link className="btn" href="/inventory">一覧に戻る</Link>
      </div>

      <div className="stack">
        <section className="card">
          <div className="section-title">既存機材の在庫を追加</div>
          <form onSubmit={addStock} className="form-grid">
            <label>
              メーカー
              <select value={selManufacturer} onChange={e => { setSelManufacturer(e.target.value); setSelEquipment(""); }}>
                <option value="">(すべて)</option>
                {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label>
              カテゴリ
              <select value={selCategory} onChange={e => { setSelCategory(e.target.value); setSelEquipment(""); }}>
                <option value="">(すべて)</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              機材
              <select value={selEquipment} onChange={e => setSelEquipment(e.target.value)}>
                <option value="">(選択)</option>
                {filteredEquipments.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.manufacturer} {eq.model}</option>
                ))}
              </select>
            </label>
            <label>
              追加数量
              <input type="number" min={1} value={incQty} onChange={e => setIncQty(Number(e.target.value))} />
            </label>
            <div><button className="btn primary" type="submit">在庫に追加</button></div>
          </form>
        </section>

        <section className="card">
          <div className="section-title">新しい機材を追加</div>
          <form onSubmit={createNew} className="form-grid">
            <label>
              カテゴリ
              <select value={newForm.category_id} onChange={e => setNewForm({ ...newForm, category_id: e.target.value })}>
                <option value="">(未選択)</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="新しいカテゴリ名" value={newCat} onChange={e => setNewCat(e.target.value)} />
              <button className="btn" type="button" onClick={addCategory}>カテゴリ追加</button>
            </div>
            <input placeholder="メーカー(必須)" value={newForm.manufacturer} onChange={e => setNewForm({ ...newForm, manufacturer: e.target.value })} required />
            <input placeholder="型番(必須)" value={newForm.model} onChange={e => setNewForm({ ...newForm, model: e.target.value })} required />
            <input type="number" placeholder="在庫数(必須)" value={newForm.stock_count} onChange={e => setNewForm({ ...newForm, stock_count: Number(e.target.value) })} required />
            <textarea placeholder="備考" value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes: e.target.value })} />
            <div><button className="btn primary" type="submit">追加</button></div>
          </form>
        </section>
      </div>
    </div>
  );
}
