import { NextResponse } from 'next/server';
import { loadData } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** GET /api/data —— 返回全量可编辑数据快照（含行业股票计数） */
export async function GET() {
  const data = loadData();

  const sectorCounts: Record<string, number> = {};
  for (const s of data.stocks) {
    sectorCounts[s.sector] = (sectorCounts[s.sector] || 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    sectors: data.sectors,
    stocks: data.stocks,
    watchlist: data.watchlist,
    alerts: data.alerts,
    sectorCounts,
  });
}
