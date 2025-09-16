import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic';

const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

export async function GET() {
  const supabase = createSupabaseServerClient();

  const [{ data: equipments, error: eqErr }, { data: categories, error: catErr }] = await Promise.all([
    supabase.from('equipments').select('*').order('manufacturer').order('model'),
    supabase.from('categories').select('id,name')
  ]);

  if (eqErr) {
    return NextResponse.json({ error: eqErr.message }, { status: 500 });
  }
  if (catErr) {
    return NextResponse.json({ error: catErr.message }, { status: 500 });
  }

  const catMap = new Map<string, string>();
  (categories || []).forEach((c: any) => catMap.set(c.id, c.name));

  const header = [
    'カテゴリ',
    'メーカー',
    '型番',
    '在庫数',
    'URL',
    '消費電力',
    '重量',
    'サイズ',
    '単価',
    '原産国',
    '備考',
    '更新日時'
  ];

  const rows = (equipments || []).map((e: any) => [
    e.category_id ? (catMap.get(e.category_id as string) || '') : '',
    e.manufacturer,
    e.model,
    e.stock_count,
    e.url ?? '',
    e.power_consumption ?? '',
    e.weight ?? '',
    e.dimensions ?? '',
    e.unit_price ?? '',
    e.origin_country ?? '',
    e.notes ?? '',
    e.updated_at
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(csvEscape).join(','))
    .join('\n');

  const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inventory_export_${now}.csv"`
    }
  });
}
