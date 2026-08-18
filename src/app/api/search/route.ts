import { NextRequest, NextResponse } from 'next/server';
import { loadData } from '@/lib/store';

/** GET /api/search?q=茅台 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';

  if (!q) {
    return NextResponse.json({ ok: true, data: [] });
  }

  const lower = q.toLowerCase();
  const results = loadData().stocks.filter(s => {
    return (
      s.name.toLowerCase().includes(lower) ||
      s.code.toLowerCase().includes(lower) ||
      s.sector.toLowerCase().includes(lower) ||
      (s.note && s.note.toLowerCase().includes(lower))
    );
  }).slice(0, 50);

  return NextResponse.json({ ok: true, data: results });
}
