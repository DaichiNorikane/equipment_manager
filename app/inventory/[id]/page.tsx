"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Equipment, Event, EquipmentUnit } from "@/lib/types";
import { useAdminMode } from "@/lib/useAdminMode";

export default function EquipmentDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const [eq, setEq] = useState<Equipment | null>(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [assign, setAssign] = useState<{ event_id: string; quantity: number }>({ event_id: "", quantity: 1 });
  const [imageBusy, setImageBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { admin } = useAdminMode();
  const [units, setUnits] = useState<EquipmentUnit[]>([]);
  const [unitBusy, setUnitBusy] = useState(false);
  const [syncingUnits, setSyncingUnits] = useState(false);
  const [unitsLoaded, setUnitsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("equipments").select("*").eq("id", id).single();
      setEq((data as Equipment) || null);
      const { data: evs } = await supabase.from('events').select('*').order('start_at', { ascending: true });
      setEvents((evs || []) as Event[]);
      const { data: uts } = await supabase.from('equipment_units').select('*').eq('equipment_id', id).order('created_at');
      setUnits((uts || []) as EquipmentUnit[]);
      setUnitsLoaded(true);
    };
    if (id) load();
  }, [id]);

  // Ensure unit rows exist up to stock_count (auto-create missing rows)
  useEffect(() => {
    const sync = async () => {
      if (!eq || syncingUnits || !unitsLoaded) return;
      const target = Number(eq.stock_count) || 0;
      const current = units.length;
      const need = target - current;
      if (need > 0) {
        setSyncingUnits(true);
        const rows = Array.from({ length: need }).map(() => ({
          equipment_id: id,
          status: '正常',
          serial: null,
          note: null,
          active: true
        }));
        const { error } = await supabase.from('equipment_units').insert(rows as any);
        if (error) {
          console.warn('unit sync insert failed:', error.message);
        } else {
          const { data: uts } = await supabase.from('equipment_units').select('*').eq('equipment_id', id).order('created_at');
          setUnits((uts || []) as EquipmentUnit[]);
        }
        setSyncingUnits(false);
      } else if (need < 0) {
        // 多い分は削除（優先: active=false を優先削除→作成が新しい順）
        setSyncingUnits(true);
        const extra = -need;
        const inactiveFirst = [...units].sort((a,b) => Number(a.active) - Number(b.active) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const ids = inactiveFirst.slice(0, extra).map(u => u.id);
        const { error } = await supabase.from('equipment_units').delete().in('id', ids);
        if (error) {
          console.warn('unit sync delete failed:', error.message);
        } else {
          const { data: uts } = await supabase.from('equipment_units').select('*').eq('equipment_id', id).order('created_at');
          setUnits((uts || []) as EquipmentUnit[]);
        }
        setSyncingUnits(false);
      }
    };
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eq?.stock_count, units.length, unitsLoaded]);

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
  const images: string[] = Array.isArray((eq as any).properties?.images) ? ((eq as any).properties!.images as string[]) : [];
  const addImage = async (file: File) => {
    if (!file || !id) return;
    setImageBusy(true);
    const ext = file.name.split('.').pop();
    const path = `${id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('equipment-images').upload(path, file, { upsert: false });
    if (upErr) { alert(`アップロードに失敗しました: ${upErr.message}`); setImageBusy(false); return; }
    const { data: pub } = supabase.storage.from('equipment-images').getPublicUrl(path);
    const url = (pub as any)?.publicUrl as string;
    const nextImages = [...images, url];
    const nextProps = { ...((eq as any).properties || {}), images: nextImages };
    const { error: upEq } = await supabase.from('equipments').update({ properties: nextProps } as any).eq('id', id);
    if (upEq) { alert(upEq.message); }
    else {
      // refresh eq
      const { data } = await supabase.from('equipments').select('*').eq('id', id).single();
      setEq((data as Equipment) || eq);
    }
    setImageBusy(false);
  };

  // Units CRUD
  const addUnit = async () => {
    setUnitBusy(true);
    const { data, error } = await supabase.from('equipment_units').insert({ equipment_id: id, status: '正常', serial: null, note: null, active: true } as any).select('*').single();
    if (error) alert(error.message);
    else setUnits(prev => [...prev, data as any as EquipmentUnit]);
    setUnitBusy(false);
  };
  const updateUnit = async (uid: string, patch: Partial<EquipmentUnit>) => {
    setUnits(prev => prev.map(u => u.id === uid ? { ...u, ...patch } : u));
  };
  const saveUnit = async (u: EquipmentUnit) => {
    const payload = { serial: u.serial || null, status: u.status, note: u.note || null, active: u.active } as any;
    const { error } = await supabase.from('equipment_units').update(payload).eq('id', u.id);
    if (error) alert(error.message);
  };
  const deleteUnitRow = async (uid: string) => {
    if (!confirm('このユニットを削除しますか？')) return;
    const { error } = await supabase.from('equipment_units').delete().eq('id', uid);
    if (error) alert(error.message);
    else setUnits(prev => prev.filter(x => x.id !== uid));
  };
  const statuses = ['正常','故障','点検中','予備','廃棄'];

  const pathFromUrl = (u: string) => {
    const re = /\/object\/public\/equipment-images\/(.+)$/;
    const m = u.match(re);
    return m ? m[1] : null;
  };

  const deleteImage = async (idx: number) => {
    if (!eq || !id) return;
    const url = images[idx];
    const path = pathFromUrl(url);
    if (!path) { alert('削除用のパスが解析できませんでした'); return; }
    setImageBusy(true);
    const { error: remErr } = await supabase.storage.from('equipment-images').remove([path]);
    if (remErr) { alert(`画像の削除に失敗しました: ${remErr.message}`); setImageBusy(false); return; }
    const nextImages = images.filter((_, i) => i !== idx);
    const nextProps = { ...((eq as any).properties || {}), images: nextImages };
    const { error: upEq } = await supabase.from('equipments').update({ properties: nextProps } as any).eq('id', id);
    if (upEq) { alert(upEq.message); }
    else {
      const { data } = await supabase.from('equipments').select('*').eq('id', id).single();
      setEq((data as Equipment) || eq);
    }
    setImageBusy(false);
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>機材詳細</h2>
        {eq.url && (
          <a
            href={eq.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pill"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            title="機材URLを開く"
            aria-label="機材URLを開く"
          >
            🔗<span>URL</span>
          </a>
        )}
      </div>
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

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="section-title">画像</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) addImage(f); e.currentTarget.value=''; }} />
          {imageBusy && <span className="subtle">アップロード中...</span>}
        </div>
        {images.length === 0 ? (
          <div className="subtle">画像はありません</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={src} alt="thumb" onClick={() => setPreview(src)}
                     style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }} />
                {admin && (
                  <button className="btn danger" title="削除" onClick={(e) => { e.stopPropagation(); deleteImage(i); }}
                          style={{ position: 'absolute', top: -6, right: -6, padding: '2px 6px' }}>×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="section-title">台数詳細（簡易）</div>
        <div className="subtle" style={{ marginBottom: 8 }}>
          {(() => {
            const summary: Record<string, number> = {};
            for (const u of units) summary[u.status] = (summary[u.status] || 0) + (u.active ? 1 : 0);
            const keys = Object.keys(summary);
            if (keys.length === 0) return '未登録です。必要なら追加してください。';
            const line = keys.map(k => `${k} ${summary[k]}台`).join(' ／ ');
            const warn = (eq?.stock_count ?? 0) < units.length ? `（在籍台数が在庫数(${eq?.stock_count})を上回っています）` : '';
            return line + (warn ? ' ' + warn : '');
          })()}
        </div>
        <details>
          <summary>編集する</summary>
          <div className="list" style={{ marginTop: 8 }}>
            {units.map(u => (
              <div key={u.id} className="row" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'center' }}>
                <input placeholder="シリアル" value={u.serial || ''} onChange={e => updateUnit(u.id, { serial: e.target.value })} onBlur={() => saveUnit(units.find(x => x.id === u.id)!)} />
                <select value={u.status} onChange={e => { const v = e.target.value; updateUnit(u.id, { status: v }); saveUnit({ ...u, status: v } as any); }}>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input placeholder="状態メモ" value={u.note || ''} onChange={e => updateUnit(u.id, { note: e.target.value })} onBlur={() => saveUnit(units.find(x => x.id === u.id)!)} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <label className="subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={u.active} onChange={e => { updateUnit(u.id, { active: e.target.checked }); saveUnit({ ...u, active: e.target.checked } as any); }} /> 在籍
                  </label>
                  <button className="btn danger" onClick={() => deleteUnitRow(u.id)}>削除</button>
                </div>
              </div>
            ))}
            <div>
              <button className="btn" disabled={unitBusy} onClick={addUnit}>行を追加</button>
            </div>
          </div>
        </details>
      </div>

      {preview && (
        <div onClick={() => setPreview(null)}
             style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
          <div style={{ position: 'relative' }}>
            <img src={preview} alt="preview" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8 }} />
            {admin && (
              <div style={{ position: 'absolute', top: 8, right: 8 }}>
                <button className="btn danger" onClick={(e) => {
                  e.stopPropagation();
                  const idx = images.indexOf(preview);
                  if (idx >= 0) deleteImage(idx);
                  setPreview(null);
                }}>削除</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
