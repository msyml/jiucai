// A股市场类型定义

/** 申万一级行业 */
export interface Sector {
  code: string;        // 板块代码 pt01801080
  name: string;        // 行业名称 电子
  sectorCode: string;  // 完整代码 sw1_pt01801080
}

/** 股票基础信息（静态） */
export interface StockInfo {
  code: string;       // sh600519
  name: string;       // 贵州茅台
  sector: string;     // 食品饮料
  market: MarketType; // 市场类型
  note?: string;      // 研究笔记
}

/** 市场类型 */
export type MarketType = 'sh-main' | 'sz-main' | 'gem' | 'star' | 'bj';

/** 实时行情（来自腾讯接口解析） */
export interface StockQuote {
  code: string;
  name: string;
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;       // 成交量（手）
  amount: number;       // 成交额（元）
  change: number;       // 涨跌额
  changePercent: number; // 涨跌幅 %
  turnoverRate: number;  // 换手率 %
  peRatio: number;       // 市盈率
  amplitude: number;     // 振幅 %
  circulationMarketCap: number; // 流通市值（万）
  totalMarketCap: number;       // 总市值（万）
  pbRatio: number;       // 市净率
  timestamp: string;     // 数据时间
}

/** 合并后的股票数据 */
export interface StockWithQuote extends StockInfo {
  quote: StockQuote | null;
}

/** 重点观察项 */
export interface WatchlistItem {
  code: string;
  stopLoss: number;    // 止损价
  support: number;     // 支撑位
  resistance: number;  // 压力位
  note: string;        // 备注
}

/** 价格预警项 */
export interface PriceAlertItem {
  code: string;
  type: 'stop-loss' | 'support' | 'resistance';
  target: number;      // 目标价
  note: string;
}

/** 市场总览数据 */
export interface MarketOverview {
  date: string;
  upCount: number;
  downCount: number;
  flatCount: number;
  totalAmount: number; // 总成交额
  limitUp: number;     // 涨停数
  limitDown: number;   // 跌停数
}
