import { NextRequest, NextResponse } from 'next/server';
import { loadData, saveData } from '@/lib/store';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/data/watchlist —— 新增/更新重点观察（需管理员） */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { code, stopLoss, support, resistance, note } = body as {
      code?: string; stopLoss?: number; support?: number; resistance?: number; note?: string;
    };
    if (!code) {
      return NextResponse.json({ ok: false, error: '缺少股票代码' }, { status: 400 });
    }
    const data = loadData();
    if (!data.stocks.some(s => s.code === code)) {
      return NextResponse.json({ ok: false, error: '股票不存在，无法加入观察' }, { status: 404 });
    }
    // 若已存在则覆盖
    data.watchlist = data.watchlist.filter(w => w.code !== code);
    data.watchlist.push({
      code,
      stopLoss: Number(stopLoss) || 0,
      support: Number(support) || 0,
      resistance: Number(resistance) || 0,
      note: note || '',
    });
    saveData(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: '请求解析失败' }, { status: 400 });
  }
}

/** DELETE /api/data/watchlist?code=xxx —— 移除重点观察（需管理员） */
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ ok: false, error: '缺少股票代码' }, { status: 400 });
  const data = loadData();
  data.watchlist = data.watchlist.filter(w => w.code !== code);
  saveData(data);
  return NextResponse.json({ ok: true });
}
