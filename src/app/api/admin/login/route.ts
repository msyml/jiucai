import { NextRequest, NextResponse } from 'next/server';
import { getAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** POST /api/admin/login —— 校验管理员口令 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = (body?.token || '').toString().trim();
    if (token && token === getAdminToken()) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: '口令错误' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: '请求解析失败' }, { status: 400 });
  }
}
