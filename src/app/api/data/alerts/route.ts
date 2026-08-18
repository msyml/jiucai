import { NextRequest, NextResponse } from 'next/server';
import { loadData, saveData } from '@/lib/store';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/data/alerts —— 新增/更新价格预警（需管理员） */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { code, type, target, note } = body as {
      code?: string;
      type?: 'stop-loss' | 'support' | 'resistance';
      target?: number;
      note?: string;
    };
    if (!code) {
      return NextResponse.json({ ok: false, error: '缺少股票代码' }, { status: 400 });
    }
    const data = loadData();
    if (!data.stocks.some(s => s.code === code)) {
      return NextResponse.json({ ok: false, error: '股票不存在，无法添加预警' }, { status: 404 });
    }
    data.alerts = data.alerts.filter(a => a.code !== code);
    data.alerts.push({
      code,
      type: type || 'support',
      target: Number(target) || 0,
      note: note || '',
    });
    saveData(data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: '请求解析失败' }, { status: 400 });
  }
}

/** DELETE /api/data/alerts?code=xxx —— 移除价格预警（需管理员） */
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ ok: false, error: '缺少股票代码' }, { status: 400 });
  const data = loadData();
  data.alerts = data.alerts.filter(a => a.code !== code);
  saveData(data);
  return NextResponse.json({ ok: true });
}
