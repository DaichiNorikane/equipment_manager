"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Category, Equipment, Rental } from "@/lib/types";
import Link from "next/link";
import AdminPanel from "@/components/AdminPanel";
import { useAdminMode } from "@/lib/useAdminMode";

export default function InventoryPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterMaker, setFilterMaker] = useState<string>("");
  const [sortMode, setSortMode] = useState<"default" | "category" | "manufacturer">("default");
  const { admin } = useAdminMode();
  const pastel = (key: string) => {
    if (!key) return { bg: '#fff', border: '#e5e7eb' };
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const bg = `hsla(${hue}, 80%, 95%, 1)`;
    const border = `hsla(${hue}, 70%, 85%, 1)`;
    return { bg, border };
  };

  const [form, setForm] = useState({
    category_id: "",
    manufacturer: "",
    model: "",
    stock_count: 0,
    notes: ""
  });

  const makers = useMemo(() => Array.from(new Set(equipments.map(e => e.manufacturer))).sort(), [equipments]);
  const filtered = useMemo(() => {
    return equipments.filter(e =>
      (filterCat ? e.category_id === filterCat : true) &&
      (filterMaker ? e.manufacturer === filterMaker : true)
    ).sort((a, b) => {
      if (sortMode === 'category') return (a.category_id || '').localeCompare(b.category_id || '') || a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model);
      if (sortMode === 'manufacturer') return a.manufacturer.localeCompare(b.manufacturer) || a.model.localeCompare(b.model);
      return 0;
    });
  }, [equipments, filterCat, filterMaker, sortMode]);

  const reload = async () => {
    const { data: eqs } = await supabase.from("equipments").select("*").order("manufacturer").order("model");
    setEquipments((eqs || []) as Equipment[]);
  };

  useEffect(() => {
    const init = async () => {
      const { data: cats } = await supabase.from("categories").select("*").order("name");
      setCategories((cats || []) as Category[]);
      await reload();
    };
    init();
  }, []);
  const [rentals, setRentals] = useState<Rental[]>([]);
  useEffect(() => {
    const loadRentals = async () => {
      const { data: rts } = await supabase.from('rentals').select('*');
      setRentals((rts || []) as Rental[]);
    };
    loadRentals();
  }, []);

  const addEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      category_id: (form.category_id || filterCat) || null,
      manufacturer: form.manufacturer,
      model: form.model,
      stock_count: Number(form.stock_count) || 0,
      notes: form.notes || null,
      properties: {}
    };
    let { error } = await supabase.from("equipments").insert(payload);
    // 互換対応: 旧スキーマ（name NOT NULL）が残っている場合は name を補完して再試行
    if (error && typeof error.message === 'string' && error.message.includes('column "name"')) {
      const legacyPayload = { ...payload, name: `${form.manufacturer} ${form.model}`.trim() } as any;
      const retry = await supabase.from("equipments").insert(legacyPayload);
      error = retry.error || null;
    }
    if (error) {
      console.error(error);
      alert(`機材の追加に失敗しました: ${error.message}`);
      return;
    }
    setForm({ category_id: "", manufacturer: "", model: "", stock_count: 0, notes: "" });
    await reload();
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">機材一覧</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AdminPanel />
        </div>
      </div>

      <div className="card toolbar">
        <label>
          カテゴリ絞り込み
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">(すべて)</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          メーカー絞り込み
          <select value={filterMaker} onChange={e => setFilterMaker(e.target.value)}>
            <option value="">(すべて)</option>
            {makers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          並び替え
          <select value={sortMode} onChange={e => setSortMode(e.target.value as any)}>
            <option value="default">追加順</option>
            <option value="category">カテゴリ別</option>
            <option value="manufacturer">メーカー別</option>
          </select>
        </label>
        <Link className="btn" href="/inventory/add">機材の追加/在庫追加</Link>
      </div>

      <div className="list">
        {filtered.map(e => {
          const cat = categories.find(c => c.id === e.category_id);
          const colors = pastel(e.category_id || e.manufacturer);
          const now = new Date();
          const eqRentals = rentals.filter(r => r.equipment_id === e.id);
          const actives = eqRentals.filter(r => new Date(r.arrive_at) <= now && new Date(r.return_at) >= now);
          const upcoming = eqRentals
            .filter(r => new Date(r.arrive_at) > now)
            .sort((a,b) => new Date(a.arrive_at).getTime() - new Date(b.arrive_at).getTime());
          const rentSum = actives.reduce((s, r) => s + (r.quantity || 0), 0);
          const start = actives.length ? new Date(Math.min(...actives.map(r => new Date(r.arrive_at).getTime()))) : (upcoming[0] ? new Date(upcoming[0].arrive_at) : null);
          const end = actives.length ? new Date(Math.max(...actives.map(r => new Date(r.return_at).getTime()))) : (upcoming[0] ? new Date(upcoming[0].return_at) : null);
          const label = actives.length > 0 ? `レンタル ${rentSum} 台` : (upcoming.length > 0 ? `次回レンタル ${upcoming[0].quantity} 台` : '');
          return (
          <div key={e.id} className="card" style={{ background: colors.bg, borderColor: colors.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b>{e.manufacturer}</b> <Link href={`/inventory/${e.id}`}>{e.model}</Link>
                {(((e as any).is_rental_only === true) || (((e as any).properties || {})['rental_only'] === true)) ? <span className="tag" style={{ marginLeft: 8 }}>レンタル</span> : null}
                {cat && <span className="tag" style={{ marginLeft: 8 }}>{cat.name}</span>}
              </div>
              {admin && (
                <button className="btn danger" onClick={async () => {
                  if (!confirm(`${e.manufacturer} ${e.model} を削除しますか？（関連するイベント割当は削除されます）`)) return;
                  const { error: e1 } = await supabase.from('event_usages').delete().eq('equipment_id', e.id);
                  if (e1) { alert(e1.message); return; }
                  const { error: e2 } = await supabase.from('equipments').delete().eq('id', e.id);
                  if (e2) { alert(e2.message); return; }
                  await reload();
                }}>削除</button>
              )}
            </div>
            <div className="subtle">
              在庫: {e.stock_count}
              {(actives.length > 0 || upcoming.length > 0) && (
                <span style={{ marginLeft: 8 }}>
                  | <Link href="/rentals">{label}</Link>
                  {start && end && (
                    <span>（{start.toLocaleDateString()} - {end.toLocaleDateString()}）</span>
                  )}
                </span>
              )}
            </div>
          </div>
        );})}
      </div>
      {admin && (
        <>
          <CategoriesAdmin categories={categories} onChanged={async () => {
            const { data: cats } = await supabase.from('categories').select('*').order('name');
            setCategories((cats || []) as Category[]);
          }} />
          <ManufacturersAdmin equipments={equipments} onChanged={reload} />
        </>
      )}
    </div>
  );
}

// 追加・カテゴリ追加は /inventory/add に集約

function ManufacturersAdmin({ equipments, onChanged }: { equipments: Equipment[]; onChanged: () => void }) {
  const makers = Array.from(new Set(equipments.map(e => e.manufacturer))).sort();
  if (makers.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <details>
        <summary>メーカー削除（管理者）</summary>
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {makers.map(m => (
            <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{m}</span>
              <button onClick={async () => {
                if (!confirm(`メーカー「${m}」の機材をすべて削除しますか？関連するイベント割当も削除されます。`)) return;
                // find equipment ids
                const ids = equipments.filter(e => e.manufacturer === m).map(e => e.id);
                if (ids.length > 0) {
                  const { error: e1 } = await supabase.from('event_usages').delete().in('equipment_id', ids);
                  if (e1) { alert(e1.message); return; }
                  const { error: e2 } = await supabase.from('equipments').delete().in('id', ids);
                  if (e2) { alert(e2.message); return; }
                }
                await onChanged();
              }}>削除</button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function CategoriesAdmin({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="section-title">カテゴリ管理（編集・削除・管理者）</div>
      <div className="list">
        {categories.map(c => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
            <input
              value={editing[c.id] ?? c.name}
              onChange={e => setEditing(prev => ({ ...prev, [c.id]: e.target.value }))}
            />
            <button className="btn" onClick={async () => {
              const name = (editing[c.id] ?? c.name).trim();
              if (!name) { alert('名前を入力してください'); return; }
              const { error } = await supabase.from('categories').update({ name }).eq('id', c.id);
              if (error) { alert(error.message); return; }
              setEditing(prev => { const n = { ...prev }; delete n[c.id]; return n; });
              await onChanged();
            }}>保存</button>
            <button className="btn danger" onClick={async () => {
              if (!confirm(`カテゴリ「${c.name}」を削除しますか？（紐づく機材のカテゴリは未設定になります）`)) return;
              const { error } = await supabase.from('categories').delete().eq('id', c.id);
              if (error) { alert(error.message); return; }
              await onChanged();
            }}>削除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
