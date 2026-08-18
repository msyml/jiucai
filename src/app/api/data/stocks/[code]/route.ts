import { NextRequest, NextResponse } from 'next/server';
import { loadData, saveData } from '@/lib/store';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** PUT /api/data/stocks/[code] —— 编辑（名称/行业/笔记，需管理员） */
export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const code = params.code;
  try {
    const body = await req.json();
    const data = loadData();
    const idx = data.stocks.findIndex(s => s.code === code);
    if (idx < 0) {
      return NextResponse.json({ ok: false, error: '未找到该股票' }, { status: 404 });
    }
    const s = data.stocks[idx];
    if (typeof body.name === 'string') s.name = body.name;
    if (typeof body.sector === 'string') s.sector = body.sector;
    if (typeof body.note === 'string') s.note = body.note;
    data.stocks[idx] = s;
    saveData(data);
    return NextResponse.json({ ok: true, stock: s });
  } catch (err) {
    return NextResponse.json({ ok: false, error: '请求解析失败' }, { status: 400 });
  }
}

/** DELETE /api/data/stocks/[code] —— 删除（级联移除观察与预警，需管理员） */
export async function DELETE(req: NextRequest, { params }: { params: { code: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const code = params.code;
  const data = loadData();
  const before = data.stocks.length;
  data.stocks = data.stocks.filter(s => s.code !== code);
  data.watchlist = data.watchlist.filter(w => w.code !== code);
  data.alerts = data.alerts.filter(a => a.code !== code);
  if (data.stocks.length === before) {
    return NextResponse.json({ ok: false, error: '未找到该股票' }, { status: 404 });
  }
  saveData(data);
  return NextResponse.json({ ok: true });
}
