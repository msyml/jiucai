// 静态导出构建脚本
// 1. Next 静态导出（output: 'export'）不支持 API routes，构建前临时把 src/app/api
//    重命名为 _api（Next 的 private folder，不会被识别为路由），构建后恢复，
//    从而保住本地 dev 的完整编辑能力。
// 2. 把当前 data/stocks.json 快照复制为 public/stocks.json，供静态站读取。
// 3. 注入 NEXT_PUBLIC_READONLY=true，使线上版本自动隐藏所有编辑入口。
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiDir = path.join(root, 'src', 'app', 'api');
const apiDisabled = path.join(root, 'src', 'app', '_api');
const dataFile = path.join(root, 'data', 'stocks.json');
const publicDir = path.join(root, 'public');
const publicData = path.join(publicDir, 'stocks.json');

let apiDisabledByUs = false;

try {
  // 1. 临时禁用 API 路由
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, apiDisabled);
    apiDisabledByUs = true;
  }

  // 2. 复制数据快照
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (fs.existsSync(dataFile)) {
    fs.copyFileSync(dataFile, publicData);
    console.log('[build-static] 已复制 data/stocks.json -> public/stocks.json');
  } else {
    console.warn('[build-static] 未找到 data/stocks.json，静态站将没有数据');
  }

  // 3. 静态导出构建（注入只读标记）
  execSync('npx next build', {
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_READONLY: 'true' },
  });
} finally {
  // 恢复 API 路由，保住本地 dev 编辑功能
  if (apiDisabledByUs && fs.existsSync(apiDisabled)) {
    fs.renameSync(apiDisabled, apiDir);
    console.log('[build-static] 已恢复 src/app/api');
  }
}
