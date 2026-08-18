import fs from 'fs';
import path from 'path';
import { STOCKS, SECTORS, WATCHLIST, PRICE_ALERTS } from './stockData';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'stocks.json');

export interface StoredStock {
  code: string;
  name: string;
  sector: string;
  market: string;
  note?: string;
}
export interface StoredData {
  sectors: { code: string; name: string; sectorCode: string }[];
  stocks: StoredStock[];
  watchlist: {
    code: string;
    stopLoss: number;
    support: number;
    resistance: number;
    note: string;
  }[];
  alerts: {
    code: string;
    type: 'stop-loss' | 'support' | 'resistance';
    target: number;
    note: string;
  }[];
}

/** 根据股票代码推断市场类型（与 stockData.ts 保持一致） */
export function getMarket(code: string): string {
  if (code.startsWith('bj')) return 'bj';
  if (code.startsWith('sh688') || code.startsWith('sz301')) return 'star';
  if (code.startsWith('sz300') || code.startsWith('sz301')) return 'gem';
  if (code.startsWith('sh')) return 'sh-main';
  return 'sz-main';
}

/** 首次运行时用静态种子初始化 JSON 文件 */
function seed(): StoredData {
  return {
    sectors: SECTORS.map(s => ({ code: s.code, name: s.name, sectorCode: s.sectorCode })),
    stocks: STOCKS.map(s => ({
      code: s.code,
      name: s.name,
      sector: s.sector,
      market: s.market,
      note: s.note || '',
    })),
    watchlist: WATCHLIST.map(w => ({ ...w })),
    alerts: PRICE_ALERTS.map(a => ({ ...a })),
  };
}

export function ensureData(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed(), null, 2), 'utf-8');
  }
}

export function loadData(): StoredData {
  ensureData();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as StoredData;
}

export function saveData(data: StoredData): void {
  ensureData();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export { DATA_FILE };
