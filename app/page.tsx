"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import type { Category, Event, EventUsage, Equipment, Rental } from "@/lib/types";

type ShortageInterval = { start_at: string; end_at: string; shortage: number; rental_used: number; arranged_ok: boolean };
type Shortage = {
  event: Event;
  equipment: Equipment;
  intervals: ShortageInterval[];
};

export default function Dashboard() {
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<{ type: string; label: string; at: string; href: string }[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ type: "category" | "equipment" | "event" | "rental"; label: string; href: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const seqRef = useRef(0);

  const doSearch = useCallback(async (keyword: string) => {
    const term = keyword.trim();
    if (!term) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setHits([]);
      setSearching(false);
      return;
    }
    const escForOr = (s: string) => s.replaceAll(/[,()]/g, m => `\\${m}`);
    const escForLike = (s: string) => s.replaceAll(/[\\%_]/g, m => `\\${m}`);
    const likeTerm = escForLike(term);
    const qq = escForOr(likeTerm);
    const runId = ++seqRef.current;
    setSearching(true);
    try {
      const [evsRes, eqsRes, rtsRes, catsRes] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .or(`name.ilike.%${qq}%,location.ilike.%${qq}%,notes.ilike.%${qq}%`)
          .limit(10),
        supabase
          .from('equipments')
          .select('*')
          .or([
            `manufacturer.ilike.%${qq}%`,
            `model.ilike.%${qq}%`,
            `notes.ilike.%${qq}%`,
            `url.ilike.%${qq}%`,
            `power_consumption.ilike.%${qq}%`,
            `weight.ilike.%${qq}%`,
            `dimensions.ilike.%${qq}%`,
            `origin_country.ilike.%${qq}%`
          ].join(','))
          .limit(10),
        supabase
          .from('rentals')
          .select('*')
          .or(`company.ilike.%${qq}%,arrive_place.ilike.%${qq}%,return_place.ilike.%${qq}%,notes.ilike.%${qq}%`)
          .limit(10),
        supabase
          .from('categories')
          .select('*')
          .ilike('name', `%${likeTerm}%`)
          .limit(10)
      ]);

      if (seqRef.current !== runId) return; // stale response

      const results: { type: "category" | "equipment" | "event" | "rental"; label: string; href: string }[] = [];
      (catsRes.data as Category[] | null)?.forEach(c => {
        results.push({ type: 'category', label: c.name, href: `/inventory?category=${c.id}` });
      });
      (eqsRes.data as Equipment[] | null)?.forEach(e => {
        results.push({ type: 'equipment', label: `${e.manufacturer} ${e.model}`, href: `/inventory/${e.id}` });
      });
      (evsRes.data as Event[] | null)?.forEach(e => {
        results.push({ type: 'event', label: e.name, href: `/events/${e.id}` });
      });
      (rtsRes.data as Rental[] | null)?.forEach(r => {
        results.push({ type: 'rental', label: r.company, href: `/rentals` });
      });
      setHits(results);
    } finally {
      if (seqRef.current === runId) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // 全期間のイベントを対象
      const { data: events, error: eventsErr } = await supabase
        .from("events")
        .select("*")
        .order("start_at", { ascending: true });

      if (eventsErr || !events) {
        setShortages([]);
        setLoading(false);
        return;
      }

      const evList = (events || []) as Event[];
      const evIds = evList.map(e => e.id);

      // Fetch all usages involved
      const { data: allUsages } = await supabase
        .from("event_usages")
        .select("*")
        .in("event_id", evIds);

      const usages = (allUsages || []) as EventUsage[];

      // Fetch all equipments referenced
      const eqIds = Array.from(new Set(usages.map(u => u.equipment_id)));
      const { data: eqs } = eqIds.length > 0
        ? await supabase.from("equipments").select("*").in("id", eqIds)
        : { data: [] } as any;
      const eqMap = new Map<string, Equipment>();
      for (const e of (eqs || []) as Equipment[]) eqMap.set(e.id, e);

      // Index usages by event and by equipment
      const usagesByEvent = new Map<string, EventUsage[]>();
      const usagesByEq = new Map<string, EventUsage[]>();
      for (const u of usages) {
        const a = usagesByEvent.get(u.event_id) || [];
        a.push(u);
        usagesByEvent.set(u.event_id, a);
        const b = usagesByEq.get(u.equipment_id) || [];
        b.push(u);
        usagesByEq.set(u.equipment_id, b);
      }

      // Fetch rentals overlapping the same window
      const { data: rentRows } = await supabase
        .from("rentals")
        .select("*");
      const rentals = (rentRows || []) as Rental[];

      // Build shortage timelines per equipment using sweep-line
      type Change = { resDelta: number; rentArrangedDelta: number; rentUnarrangedDelta: number };
      const shortageByEq = new Map<string, ShortageInterval[]>();
      for (const eqId of eqIds) {
        const eq = eqMap.get(eqId);
        if (!eq) continue;
        const byT = new Map<number, Change>();
        for (const u of usagesByEq.get(eqId) || []) {
          const ev = evList.find(e => e.id === u.event_id);
          if (!ev) continue;
          const ts = new Date(ev.start_at).getTime();
          const te = new Date(ev.end_at).getTime();
          byT.set(ts, { resDelta: (byT.get(ts)?.resDelta || 0) + u.quantity, rentArrangedDelta: byT.get(ts)?.rentArrangedDelta || 0, rentUnarrangedDelta: byT.get(ts)?.rentUnarrangedDelta || 0 });
          byT.set(te, { resDelta: (byT.get(te)?.resDelta || 0) - u.quantity, rentArrangedDelta: byT.get(te)?.rentArrangedDelta || 0, rentUnarrangedDelta: byT.get(te)?.rentUnarrangedDelta || 0 });
        }
        for (const r of rentals.filter(r => r.equipment_id === eqId)) {
          const ts = new Date(r.arrive_at).getTime();
          const te = new Date(r.return_at).getTime();
          const arranged = !!(r as any).arranged;
          if (!byT.has(ts)) byT.set(ts, { resDelta: 0, rentArrangedDelta: 0, rentUnarrangedDelta: 0 });
          if (!byT.has(te)) byT.set(te, { resDelta: 0, rentArrangedDelta: 0, rentUnarrangedDelta: 0 });
          const atS = byT.get(ts)!;
          const atE = byT.get(te)!;
          if (arranged) {
            atS.rentArrangedDelta += r.quantity;
            atE.rentArrangedDelta -= r.quantity;
          } else {
            atS.rentUnarrangedDelta += r.quantity;
            atE.rentUnarrangedDelta -= r.quantity;
          }
        }
        if (byT.size === 0) continue;
        const times = Array.from(byT.keys()).sort((a, b) => a - b);
        let reserved = 0;
        let rentalArr = 0;
        let rentalUnarr = 0;
        const intervals: ShortageInterval[] = [];
        for (let i = 0; i < times.length - 1; i++) {
          const t = times[i];
          const ch = byT.get(t)!;
          reserved += ch.resDelta; // apply delta at segment start
          rentalArr += ch.rentArrangedDelta;
          rentalUnarr += ch.rentUnarrangedDelta;
          const nextT = times[i + 1];
          const neededOverStock = Math.max(0, reserved - (eq.stock_count || 0));
          const totalRental = rentalArr + rentalUnarr;
          const rentalUsed = Math.min(totalRental, neededOverStock);
          const arrangedCover = Math.min(rentalArr, rentalUsed);
          const arranged_ok = arrangedCover === rentalUsed;
          const shortage = Math.max(0, neededOverStock - rentalUsed);
          if ((shortage > 0 || rentalUsed > 0) && nextT > t) {
            intervals.push({ start_at: new Date(t).toISOString(), end_at: new Date(nextT).toISOString(), shortage, rental_used: rentalUsed, arranged_ok });
          }
        }
        shortageByEq.set(eqId, intervals);
      }

      // Assemble shortages per event by intersecting its window with the equipment shortage timeline
      const result: Shortage[] = [];
      for (const ev of evList) {
        const evUsages = usagesByEvent.get(ev.id) || [];
        const a1 = new Date(ev.start_at).getTime();
        const a2 = new Date(ev.end_at).getTime();
        for (const u of evUsages) {
          const eq = eqMap.get(u.equipment_id);
          if (!eq) continue;
          const segments = shortageByEq.get(u.equipment_id) || [];
          const inters: ShortageInterval[] = [];
          for (const seg of segments) {
            const b1 = new Date(seg.start_at).getTime();
            const b2 = new Date(seg.end_at).getTime();
            const st = Math.max(a1, b1);
            const en = Math.min(a2, b2);
            if (en > st) inters.push({ start_at: new Date(st).toISOString(), end_at: new Date(en).toISOString(), shortage: seg.shortage, rental_used: seg.rental_used, arranged_ok: seg.arranged_ok });
          }
          if (inters.length > 0) result.push({ event: ev, equipment: eq, intervals: inters });
        }
      }

      setShortages(result);
      // Recent updates (top 10)
      const rec: { type: string; label: string; at: string; href: string }[] = [];
      const { data: ev10 } = await supabase.from('events').select('*').order('updated_at', { ascending: false }).limit(10);
      (ev10 || []).forEach((e: any) => rec.push({ type: 'イベント', label: e.name, at: e.updated_at, href: `/events/${e.id}` }));
      const { data: eq10 } = await supabase.from('equipments').select('*').order('updated_at', { ascending: false }).limit(10);
      (eq10 || []).forEach((e: any) => rec.push({ type: '機材', label: `${e.manufacturer} ${e.model}`, at: e.updated_at, href: `/inventory/${e.id}` }));
      const { data: rt10 } = await supabase.from('rentals').select('*').order('created_at', { ascending: false }).limit(10);
      (rt10 || []).forEach((r: any) => rec.push({ type: 'レンタル', label: `${r.company}`, at: r.created_at, href: `/rentals` }));
      rec.sort((a,b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setRecent(rec.slice(0,10));
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!q.trim()) {
      setHits([]);
      setSearching(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      doSearch(q);
    }, 400);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [q, doSearch]);

  const groupedHits = useMemo(() => {
    const map = new Map<string, { label: string; href: string }[]>();
    for (const h of hits) {
      const arr = map.get(h.type) || [];
      arr.push({ label: h.label, href: h.href });
      map.set(h.type, arr);
    }
    return map;
  }, [hits]);

  const searchForms = [
    { type: 'category', title: 'カテゴリ', icon: '🗂️' },
    { type: 'equipment', title: '機材', icon: '🧰' },
    { type: 'event', title: 'イベント', icon: '📅' },
    { type: 'rental', title: 'レンタル', icon: '🚚' }
  ] as const;

  return (
    <div className="stack">
      <h2 className="page-title">ダッシュボード</h2>
      <form
        className="card"
        style={{ display: 'flex', gap: 8, alignItems: 'center' }}
        onSubmit={e => {
          e.preventDefault();
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
          }
          doSearch(q);
        }}
      >
        <input
          placeholder="検索（カテゴリ/機材/イベント/レンタル など）"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ maxWidth: 380 }}
        />
        <button className="btn" type="submit" disabled={searching}>検索</button>
        {searching && <span className="subtle">検索中...</span>}
      </form>
      {hits.length > 0 && (
        <div className="card">
          <div className="section-title">検索結果</div>
          {searchForms.map(meta => {
            const items = groupedHits.get(meta.type);
            if (!items || items.length === 0) return null;
            return (
              <div key={meta.type} style={{ marginTop: 8 }}>
                <div className="subtle" style={{ marginBottom: 4 }}>{meta.icon} {meta.title}</div>
                <div className="list">
                  {items.map((h, i) => (
                    <a key={`${meta.type}-${i}`} href={h.href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{meta.icon}</span>
                      <span>{h.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="subtle">全期間のイベントで、期間が重なることにより不足する区間と台数を表示します。レンタル分が不足を相殺する場合は「不足0（内レンタルn台）」と表示します。</p>
      {recent.length > 0 && (
        <div className="card">
          <div className="section-title">最新の更新</div>
          <div className="list">
            {recent.map((r,i) => (
              <a key={i} href={r.href}>{new Date(r.at).toLocaleString()} - {r.type}: {r.label}</a>
            ))}
          </div>
        </div>
      )}
      {loading && <div className="card">読み込み中...</div>}
      {!loading && shortages.length === 0 && <div className="card">不足はありません。</div>}
      {!loading && shortages.length > 0 && (
        <div className="list">
          {shortages.map((s, i) => (
            <div key={i} className="card">
              <div><b>イベント:</b> {s.event.name} （{new Date(s.event.start_at).toLocaleDateString()} - {new Date(s.event.end_at).toLocaleDateString()}）</div>
              <div><b>機材:</b> {s.equipment.manufacturer} {s.equipment.model} <span className="tag">在庫 {s.equipment.stock_count}</span></div>
              <div className="list" style={{ marginTop: 6 }}>
                {s.intervals.map((iv, j) => {
                  const label = iv.shortage === 0
                    ? `不足 0（内レンタル ${iv.rental_used} 台）`
                    : `不足 ${iv.shortage}${iv.rental_used ? `（内レンタル ${iv.rental_used} 台）` : ''}`;
                  const cls = (iv.shortage > 0 || (iv.rental_used > 0 && !iv.arranged_ok)) ? 'pill danger' : 'pill';
                  return (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div className="subtle">{new Date(iv.start_at).toLocaleString()} - {new Date(iv.end_at).toLocaleString()}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={cls}>{label}</span>
                        <Link className="btn" href="/rentals">レンタル</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
