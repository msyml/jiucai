import { NextRequest, NextResponse } from 'next/server';
import { loadData } from '@/lib/store';
import type { StockQuote } from '@/lib/types';

/**
 * 腾讯行情接口解析
 * 字段索引（以 ~ 分隔，注意 field 29 为空，所以后续字段全部 +1）：
 * 0: 市场代码  1: 名称  2: 代码  3: 最新价  4: 昨收  5: 今开
 * 6: 成交量(手)  7: 外盘  8: 内盘
 * 9-28: Level2 五档买卖盘
 * 29: 空  30: 日期时间  31: 涨跌额  32: 涨跌幅  33: 最高  34: 最低
 * 35: 价格/量/额  36: 成交量  37: 成交额(万)  38: 换手率
 * 39: 市盈率(动)  40: ?  41: 最高  42: 最低  43: 振幅
 * 44: 总市值(亿)  45: 流通市值(亿)  46: 市净率  47: 涨停价  48: 跌停价
 */
function parseTencentQuote(line: string): StockQuote | null {
  const match = line.match(/v_(\w+)="([\s\S]+?)"/);
  if (!match) return null;

  const code = match[1];
  const fields = match[2].split('~');
  if (fields.length < 40) return null;

  const num = (i: number) => {
    const v = parseFloat(fields[i]);
    return isNaN(v) ? 0 : v;
  };

  // GBK 解码后 fields[1] 即为正确中文名
  return {
    code,
    name: fields[1] || '',
    price: num(3),
    prevClose: num(4),
    open: num(5),
    volume: num(6),
    amount: num(37) * 10000,       // 万 → 元
    change: num(31),
    changePercent: num(32),
    high: num(33),
    low: num(34),
    turnoverRate: num(38),
    peRatio: num(39),
    amplitude: num(43),
    circulationMarketCap: num(45) * 100000000, // 亿 → 元
    totalMarketCap: num(44) * 100000000,
    pbRatio: num(46),
    timestamp: fields[30] || '',
  };
}

/** 从腾讯接口批量获取行情 */
async function fetchQuotes(codes: string[]): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>();
  if (codes.length === 0) return result;

  // 腾讯接口每次最多支持 ~100 只
  const batchSize = 80;
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const query = batch.join(',');
    const url = `https://qt.gtimg.cn/q=${query}`;

    try {
      const resp = await fetch(url, {
        headers: { 'Referer': 'https://gu.qq.com/' },
        cache: 'no-store',
      });
      // 腾讯API返回GBK编码，需要手动解码
      const buffer = Buffer.from(await resp.arrayBuffer());
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);
      const lines = text.trim().split('\n');
      for (const line of lines) {
        const quote = parseTencentQuote(line.trim());
        if (quote) {
          result.set(quote.code, quote);
        }
      }
    } catch (err) {
      console.error('fetchQuotes error:', err);
    }
  }

  return result;
}

/** GET /api/quote?codes=sh600519,sz000001 或 /api/quote?all=1 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const codesParam = searchParams.get('codes');
  const all = searchParams.get('all') === '1';

  let codes: string[];
  if (all) {
    codes = loadData().stocks.map(s => s.code);
  } else if (codesParam) {
    codes = codesParam.split(',').filter(Boolean);
  } else {
    return NextResponse.json({ error: 'Missing codes parameter' }, { status: 400 });
  }

  const quotes = await fetchQuotes(codes);

  const data: Record<string, StockQuote> = {};
  for (const [code, quote] of quotes) {
    data[code] = quote;
  }

  return NextResponse.json({
    ok: true,
    data,
    count: Object.keys(data).length,
    timestamp: new Date().toISOString(),
  });
}
