import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_TOKEN = 'jiucai-admin';
let warned = false;

/** 读取管理员口令；未配置时回退到默认并打一次告警提示。 */
export function getAdminToken(): string {
  const t = process.env.ADMIN_TOKEN;
  if (!t && !warned) {
    warned = true;
    console.warn(
      '[auth] 未设置 ADMIN_TOKEN，使用了默认口令 "jiucai-admin"。生产部署前请在 .env.local 中设置一个强口令。'
    );
  }
  return t || DEFAULT_TOKEN;
}

/**
 * 校验请求是否携带正确的管理员口令（Authorization: Bearer <token>）。
 * 通过返回 null；未通过返回 403 响应，调用方直接 return 即可。
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const expected = getAdminToken();
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: '需要管理员权限' }, { status: 403 });
  }
  return null;
}
