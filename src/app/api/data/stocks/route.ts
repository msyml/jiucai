import { NextRequest, NextResponse } from 'next/server';
import { loadData, saveData, getMarket } from '@/lib/store';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/data/stocks —— 新增一只股票（需管理员） */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { code, name, sector, note } = body as {
      code?: string; name?: string; sector?: string; note?: string;
    };

    if (!code || !name || !sector) {
      return NextResponse.json({ ok: false, error: '代码、名称、行业为必填项' }, { status: 400 });
    }

    const data = loadData();
    if (data.stocks.some(s => s.code === code)) {
      return NextResponse.json({ ok: false, error: '该股票代码已存在' }, { status: 409 });
    }

    const stock = {
      code,
      name,
      sector,
      market: getMarket(code),
      note: note || '',
    };
    data.stocks.push(stock);
    saveData(data);

    return NextResponse.json({ ok: true, stock });
  } catch (err) {
    return NextResponse.json({ ok: false, error: '请求解析失败' }, { status: 400 });
  }
}
