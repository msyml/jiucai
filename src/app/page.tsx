'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { StockQuote, StockInfo, Sector, WatchlistItem, PriceAlertItem } from '@/lib/types';

const PAGE_SIZE = 24;

// ========== 图标组件 ==========
const Icon = {
  Search: () => <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>,
  Chart: () => <svg viewBox="0 0 24 24"><path d="m5 18 5-5 4 3 5-7"/><path d="M15 9h4v4"/></svg>,
  Book: () => <svg viewBox="0 0 24 24"><path d="M5 4h14v16H7a2 2 0 0 1-2-2V4Z"/><path d="M9 8h6M9 12h5"/></svg>,
  Note: () => <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h5"/><path d="m15 15 4 4m0-4-4 4"/></svg>,
  Bell: () => <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>,
  Close: () => <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>,
  Back: () => <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>,
  Log: () => <svg viewBox="0 0 24 24"><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>,
  Lock: () => <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>,
  Tag: () => <svg viewBox="0 0 24 24"><path d="m20 13-7 7-9-9V4h7l9 9Z"/><circle cx="8" cy="8" r="1"/></svg>,
  Menu: () => <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  Star: () => <span>★</span>,
  Plus: () => <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  Edit: () => <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
};

// ========== 工具函数 ==========
function formatVolume(v: number): string {
  if (v >= 100000000) return (v / 100000000).toFixed(2) + '亿';
  if (v >= 10000) return (v / 10000).toFixed(2) + '万';
  return v.toFixed(0);
}
function formatMarketCap(v: number): string {
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '亿';
  if (v >= 10000) return (v / 10000).toFixed(1) + '万';
  return v.toFixed(0);
}
function changeClass(pct: number): string {
  return pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
}

// 腾讯行情接口解析（浏览器直连，GBK 解码）
function parseTencentQuote(line: string): StockQuote | null {
  const match = line.match(/v_(\w+)="([\s\S]+?)"/);
  if (!match) return null;
  const code = match[1];
  const fields = match[2].split('~');
  if (fields.length < 38) return null;
  const num = (i: number) => {
    const v = parseFloat(fields[i]);
    return isNaN(v) ? 0 : v;
  };
  return {
    code,
    name: fields[1] || '',
    price: num(3),
    prevClose: num(4),
    open: num(5),
    volume: num(6),
    amount: num(36) * 10000,
    change: num(30),
    changePercent: num(31),
    high: num(32),
    low: num(33),
    turnoverRate: num(37),
    peRatio: num(38),
    amplitude: num(42),
    circulationMarketCap: num(44) * 100000000,
    totalMarketCap: num(43) * 100000000,
    pbRatio: num(45),
    timestamp: fields[29] || '',
  };
}

// ========== 主组件 ==========
export default function HomePage() {
  // 行情数据
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [quoteTime, setQuoteTime] = useState<string>('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineCount, setOnlineCount] = useState(Math.floor(Math.random() * 20) + 5);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [boardFilter, setBoardFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('change');
  const [missingNotesOnly, setMissingNotesOnly] = useState(false);

  // 分页
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // 详情面板
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 可编辑数据（来自 /api/data，落盘到 data/stocks.json）
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [sectorCounts, setSectorCounts] = useState<Record<string, number>>({});
  const [stockMap, setStockMap] = useState<Map<string, StockInfo>>(new Map());
  const [dataReady, setDataReady] = useState(false);

  // 运行模式：GitHub Pages 静态只读版隐藏编辑；本地 dev 保留完整编辑能力
  const READONLY = process.env.NEXT_PUBLIC_READONLY === 'true';
  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // 管理模式（管理员口令）
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // 编辑弹窗状态
  type ModalState = null | { mode: 'add' } | { mode: 'edit' };
  const [modal, setModal] = useState<ModalState>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formSector, setFormSector] = useState('');
  const [formNote, setFormNote] = useState('');

  // Toast
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const toastId = useRef(0);

  const showToast = useCallback((msg: string, type = 'info') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ========== 行情获取（浏览器直连腾讯公开接口） ==========
  const fetchQuotes = useCallback(async () => {
    if (stocks.length === 0) return;
    try {
      const codes = stocks.map(s => s.code);
      const url = `https://qt.gtimg.cn/q=${codes.join(',')}`;
      const resp = await fetch(url, { headers: { Referer: 'https://gu.qq.com/' } });
      if (!resp.ok) throw new Error('fetch failed');
      const buf = await resp.arrayBuffer();
      const text = new TextDecoder('gbk').decode(buf);
      const map = new Map<string, StockQuote>();
      for (const line of text.split(';')) {
        const q = parseTencentQuote(line);
        if (q) map.set(q.code, q);
      }
      if (map.size > 0) {
        setQuotes(map);
        setQuoteTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
        setIsOnline(true);
      }
    } catch (err) {
      console.error('fetchQuotes error:', err);
      setIsOnline(false);
    }
  }, [stocks]);

  // ========== 可编辑数据获取（双模式） ==========
  const fetchData = useCallback(async () => {
    try {
      if (READONLY) {
        // 静态只读版：直接读取构建时打包的静态 JSON（GitHub Pages）
        const resp = await fetch(`${BASE_PATH}/stocks.json`);
        if (!resp.ok) throw new Error('fetch data failed');
        const json = await resp.json();
        setStocks(json.stocks || []);
        setSectors(json.sectors || []);
        setWatchlist(json.watchlist || []);
        setAlerts(json.alerts || []);
        const counts: Record<string, number> = {};
        for (const s of (json.stocks || [])) counts[s.sector] = (counts[s.sector] || 0) + 1;
        setSectorCounts(counts);
        setStockMap(new Map((json.stocks || []).map((s: StockInfo) => [s.code, s])));
      } else {
        // 本地 dev：从 API 读取（可读写 data/stocks.json）
        const resp = await fetch('/api/data');
        if (!resp.ok) throw new Error('fetch data failed');
        const json = await resp.json();
        if (json.ok) {
          setStocks(json.stocks || []);
          setSectors(json.sectors || []);
          setWatchlist(json.watchlist || []);
          setAlerts(json.alerts || []);
          setSectorCounts(json.sectorCounts || {});
          setStockMap(new Map((json.stocks || []).map((s: StockInfo) => [s.code, s])));
        }
      }
    } catch (err) {
      console.error('fetchData error:', err);
    } finally {
      setDataReady(true);
    }
  }, [READONLY, BASE_PATH]);

  // 初始加载数据
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 数据就绪后拉取行情 + 每 30 秒刷新
  useEffect(() => {
    if (stocks.length === 0) return;
    fetchQuotes();
    const timer = setInterval(fetchQuotes, 30000);
    return () => clearInterval(timer);
  }, [fetchQuotes, stocks.length]);

  // ========== 别名：让既有渲染逻辑无需大改 ==========
  const STOCKS = stocks;
  const SECTORS = sectors;
  const WATCHLIST = watchlist;
  const PRICE_ALERTS = alerts;
  const STOCK_MAP = stockMap;

  // ========== 管理模式：登录/登出 + 携带口令的请求封装 ==========
  const authFetch = (url: string, opts: RequestInit = {}) =>
    fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
    });

  useEffect(() => {
    const t = localStorage.getItem('jiucai_admin_token') || '';
    if (t) { setAdminToken(t); setIsAdmin(true); }
  }, []);

  const doLogin = async () => {
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: loginInput }),
      });
      const json = await resp.json();
      if (json.ok) {
        localStorage.setItem('jiucai_admin_token', loginInput);
        setAdminToken(loginInput);
        setIsAdmin(true);
        setLoginOpen(false);
        setLoginInput('');
        setLoginErr('');
        showToast('已进入管理模式', 'success');
      } else {
        setLoginErr(json.error || '口令错误');
      }
    } catch {
      setLoginErr('网络错误，登录失败');
    }
  };

  const doLogout = () => {
    localStorage.removeItem('jiucai_admin_token');
    setAdminToken('');
    setIsAdmin(false);
    showToast('已退出管理模式', 'info');
  };

  // ========== 数据增删改处理函数 ==========
  const openAdd = () => {
    setFormCode('');
    setFormName('');
    setFormSector(sectors[0]?.name || '');
    setFormNote('');
    setModal({ mode: 'add' });
  };

  const openEdit = (code: string) => {
    const s = stockMap.get(code);
    if (!s) return;
    setFormCode(s.code);
    setFormName(s.name);
    setFormSector(s.sector);
    setFormNote(s.note || '');
    setModal({ mode: 'edit' });
  };

  const saveStock = async () => {
    if (!formCode || !formName || !formSector) {
      showToast('请填写代码、名称、行业', 'info');
      return;
    }
    const isEdit = modal?.mode === 'edit';
    const url = isEdit ? `/api/data/stocks/${formCode}` : '/api/data/stocks';
    try {
      const resp = await authFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formCode, name: formName, sector: formSector, note: formNote }),
      });
      const json = await resp.json();
      if (json.ok) {
        showToast(isEdit ? '已保存修改' : '已新增股票', 'success');
        setModal(null);
        await fetchData();
      } else {
        showToast(json.error || '操作失败', 'alert');
      }
    } catch (err) {
      showToast('网络错误，保存失败', 'alert');
    }
  };

  const deleteStock = async (code: string) => {
    if (!confirm(`确定删除 ${code} 吗？该操作会同时移除它的观察与预警。`)) return;
    try {
      const resp = await authFetch(`/api/data/stocks/${code}`, { method: 'DELETE' });
      const json = await resp.json();
      if (json.ok) {
        showToast('已删除', 'success');
        if (detailCode === code) closeDetail();
        await fetchData();
      } else {
        showToast(json.error || '删除失败', 'alert');
      }
    } catch (err) {
      showToast('网络错误，删除失败', 'alert');
    }
  };

  const toggleWatch = async (code: string) => {
    const exists = watchlist.some(w => w.code === code);
    try {
      if (exists) {
        await authFetch(`/api/data/watchlist?code=${code}`, { method: 'DELETE' });
      } else {
        const q = quotes.get(code);
        const base = q ? q.price : 0;
        await authFetch('/api/data/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            stopLoss: +(base * 0.9).toFixed(2),
            support: +(base * 0.95).toFixed(2),
            resistance: +(base * 1.1).toFixed(2),
            note: '',
          }),
        });
      }
      await fetchData();
    } catch (err) {
      showToast('操作失败', 'alert');
    }
  };

  const toggleAlert = async (code: string) => {
    const exists = alerts.some(a => a.code === code);
    try {
      if (exists) {
        await authFetch(`/api/data/alerts?code=${code}`, { method: 'DELETE' });
      } else {
        const q = quotes.get(code);
        const base = q ? q.price : 0;
        await authFetch('/api/data/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, type: 'support', target: +(base * 1.1).toFixed(2), note: '' }),
        });
      }
      await fetchData();
    } catch (err) {
      showToast('操作失败', 'alert');
    }
  };

  const removeWatch = async (code: string) => {
    await authFetch(`/api/data/watchlist?code=${code}`, { method: 'DELETE' });
    await fetchData();
  };

  const removeAlert = async (code: string) => {
    await authFetch(`/api/data/alerts?code=${code}`, { method: 'DELETE' });
    await fetchData();
  };

  // 在线人数模拟
  useEffect(() => {
    const timer = setInterval(() => {
      setOnlineCount(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(1, Math.min(50, prev + delta));
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 价格预警检查
  useEffect(() => {
    if (quotes.size === 0) return;
    for (const alert of PRICE_ALERTS) {
      const q = quotes.get(alert.code);
      if (!q) continue;
      const distance = Math.abs(q.price - alert.target) / alert.target;
      if (distance < 0.015) {
        const stock = STOCK_MAP.get(alert.code);
        const key = `alert-${alert.code}-${alert.type}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          showToast(`${stock?.name || alert.code} ${alert.note}：当前价 ${q.price.toFixed(2)}，目标 ${alert.target.toFixed(2)}`, 'alert');
        }
      }
    }
  }, [quotes, showToast]);

  // ========== 筛选逻辑 ==========
  const filteredStocks = useMemo(() => {
    let result = STOCKS.filter(s => {
      // 行业标签筛选
      if (activeTags.size > 0 && !activeTags.has(s.sector)) return false;
      // 板块筛选
      if (boardFilter !== 'all') {
        if (boardFilter === 'st') {
          if (!s.name.includes('ST') && !s.name.includes('*ST')) return false;
        } else if (s.market !== boardFilter) return false;
      }
      // 搜索
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) &&
            !s.code.toLowerCase().includes(q) &&
            !s.sector.toLowerCase().includes(q) &&
            !(s.note && s.note.toLowerCase().includes(q))) return false;
      }
      // 未写笔记
      if (missingNotesOnly && s.note) return false;
      return true;
    });

    // 排序
    result = [...result].sort((a, b) => {
      const qa = quotes.get(a.code);
      const qb = quotes.get(b.code);
      switch (sortBy) {
        case 'change':
          return (qb?.changePercent ?? -999) - (qa?.changePercent ?? -999);
        case 'name':
          return a.name.localeCompare(b.name, 'zh');
        case 'code':
          return a.code.localeCompare(b.code);
        case 'updated':
          return 0; // 静态数据，保持原序
        default:
          return 0;
      }
    });

    return result;
  }, [activeTags, boardFilter, searchQuery, sortBy, missingNotesOnly, quotes, stocks]);

  const visibleStocks = filteredStocks.slice(0, displayCount);

  // 标签集合统计
  const tagCollectionStats = useMemo(() => {
    if (activeTags.size === 0) return null;
    const tagStocks = STOCKS.filter(s => activeTags.has(s.sector));
    let upCount = 0, downCount = 0, totalChange = 0, count = 0;
    for (const s of tagStocks) {
      const q = quotes.get(s.code);
      if (q) {
        count++;
        totalChange += q.changePercent;
        if (q.changePercent > 0) upCount++;
        else if (q.changePercent < 0) downCount++;
      }
    }
    return {
      total: tagStocks.length,
      withQuote: count,
      upCount,
      downCount,
      avgChange: count > 0 ? totalChange / count : 0,
    };
  }, [activeTags, quotes, stocks]);

  // ========== 事件处理 ==========
  const toggleTag = (tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
    setDisplayCount(PAGE_SIZE);
  };

  const clearTags = () => {
    setActiveTags(new Set());
    setDisplayCount(PAGE_SIZE);
  };

  const openDetail = (code: string) => {
    setDetailCode(code);
  };

  const closeDetail = () => {
    setDetailCode(null);
  };

  // `/` 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('globalSearch')?.focus();
      }
      if (e.key === 'Escape') {
        closeDetail();
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const detailStock = detailCode ? STOCK_MAP.get(detailCode) : null;
  const detailQuote = detailCode ? quotes.get(detailCode) : null;

  // ========== 渲染 ==========
  return (
    <div className="app-shell">
      {/* ===== 左侧边栏 ===== */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Icon.Chart />
          </div>
          <div>
            <strong>韭菜地图</strong>
            <span>A股知识库</span>
          </div>
        </div>

        <div className={`nav-card ${activeTags.size === 0 && boardFilter === 'all' && !searchQuery ? 'active' : ''}`}
          onClick={() => { setSearchQuery(''); setBoardFilter('all'); setActiveTags(new Set()); setDisplayCount(PAGE_SIZE); }}
        >
          <Icon.Book />
          <span>全部股票</span>
          <b>{STOCKS.length}</b>
        </div>

        <section className="filter-section">
          <div className="section-heading">
            <span>行业标签</span>
            {activeTags.size > 0 && <button onClick={clearTags}>清除</button>}
          </div>
          <div className="tag-filters">
            {SECTORS.map(sector => {
              const count = sectorCounts[sector.name] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={sector.code}
                  className={`tag-chip ${activeTags.has(sector.name) ? 'active' : ''}`}
                  onClick={() => toggleTag(sector.name)}
                >
                  {sector.name}
                  <span className="count">{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="sidebar-footer">
          <div className="source-status">
            <i className={`status-dot ${isOnline ? '' : 'offline'}`} />
            <div>
              <strong>{isOnline ? '行情已连接' : '正在连接…'}</strong>
              <small>{isOnline ? '交易时段每30秒更新' : '等待服务器响应'}</small>
            </div>
          </div>
          <p>行情来自第三方公开接口，可能延迟或中断。</p>
        </div>
      </aside>

      {/* ===== 主内容区 ===== */}
      <main className="main-content">
        {/* 顶部栏 */}
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Icon.Menu />
          </button>
          <div className="search-tools">
            <label className="global-search" htmlFor="globalSearch">
              <Icon.Search />
              <input
                id="globalSearch"
                type="text"
                placeholder="搜索代码、名称、行业、关键词或笔记…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setDisplayCount(PAGE_SIZE); }}
                autoComplete="off"
              />
              <kbd>/</kbd>
            </label>
            <button
              className="note-filter-button"
              aria-pressed={missingNotesOnly}
              onClick={() => setMissingNotesOnly(!missingNotesOnly)}
              title="只看还没有填写研究笔记的股票"
            >
              <Icon.Note />
              <span>未写笔记</span>
            </button>
          </div>
          <div className="topbar-status">
            {!READONLY && (isAdmin ? (
              <button className="admin-badge active" onClick={doLogout} title="点击退出管理模式">
                <Icon.Lock /> 管理模式
              </button>
            ) : (
              <button className="admin-badge" onClick={() => setLoginOpen(true)} title="管理员登录">
                <Icon.Lock /> 管理登录
              </button>
            ))}
            <div className="public-badge"><i /> 粉丝公开版</div>
            <div className="online-badge"><i /> 在线 {onlineCount} 人</div>
          </div>
        </header>

        {/* 页面内容 */}
        <div className="page-content">
          {/* Hero */}
          <section className="hero">
            <div>
              <div className="eyebrow">JIU CAI · A-SHARE MAP</div>
              <h1>韭菜地图 · A股知识库</h1>
              <p>把全市场股票按行业、关键词与走势线索组织起来，快速找到你想研究的方向。</p>
            </div>
            <div className="hero-note">
              <strong>仅供学习交流</strong>
              <span>不构成任何投资建议</span>
            </div>
          </section>

          {/* 工具栏 */}
          <section className="toolbar">
            <div className={`quote-stamp ${isOnline ? '' : 'offline'}`}>
              <i />
              <span>{quoteTime ? `服务器 ${quoteTime} 已更新` : '行情准备中'}</span>
            </div>
            <div className="view-actions">
              <label className="sort-select">
                <span>板块</span>
                <select value={boardFilter} onChange={e => { setBoardFilter(e.target.value); setDisplayCount(PAGE_SIZE); }}>
                  <option value="all">全部市场</option>
                  <option value="sh-main">沪市主板</option>
                  <option value="sz-main">深市主板</option>
                  <option value="gem">创业板</option>
                  <option value="star">科创板</option>
                  <option value="bj">北交所</option>
                  <option value="st">ST 股</option>
                </select>
              </label>
              <label className="sort-select">
                <span>排序</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="change">今日涨跌</option>
                  <option value="name">股票名称</option>
                  <option value="code">股票代码</option>
                  <option value="updated">最近更新</option>
                </select>
              </label>
              {isAdmin && !READONLY && (
              <button className="add-stock-button" onClick={openAdd}>
                <Icon.Plus /> 新增股票
              </button>
              )}
            </div>
          </section>

          {/* 统计卡片 */}
          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-icon red"><Icon.Book /></div>
              <div>
                <span>收录股票</span>
                <strong>{STOCKS.length}</strong>
              </div>
              <small>覆盖沪深京市场</small>
            </article>
            <article className="stat-card">
              <div className="stat-icon amber"><Icon.Tag /></div>
              <div>
                <span>主要行业</span>
                <strong>{SECTORS.length}</strong>
              </div>
              <small>支持组合筛选</small>
            </article>
          </section>

          {/* 标签集合走势 */}
          {tagCollectionStats && (
            <section className="tag-collection-section">
              <div className="tag-collection-heading">
                <span className="tag-collection-icon">∩</span>
                <div>
                  <h2>标签集合走势</h2>
                  <p>共 {tagCollectionStats.total} 只 · 有行情 {tagCollectionStats.withQuote} 只</p>
                </div>
                <div className="tag-collection-tags">
                  {[...activeTags].map(t => (
                    <span key={t} className="tag-chip active" style={{ cursor: 'default' }}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="tag-collection-content">
                <div className="collection-stat">
                  <label>平均涨跌</label>
                  <b className={changeClass(tagCollectionStats.avgChange)}>
                    {tagCollectionStats.avgChange > 0 ? '+' : ''}{tagCollectionStats.avgChange.toFixed(2)}%
                  </b>
                </div>
                <div className="collection-stat">
                  <label>上涨</label>
                  <b className="up">{tagCollectionStats.upCount}</b>
                </div>
                <div className="collection-stat">
                  <label>下跌</label>
                  <b className="down">{tagCollectionStats.downCount}</b>
                </div>
              </div>
            </section>
          )}

          {/* 重点观察 */}
          <section className="watchlist-section">
            <div className="section-heading-bar">
              <span className="heading-icon">★</span>
              <div>
                <h2>重点观察</h2>
                <p>韭菜地图重点观察 {WATCHLIST.length} 只</p>
              </div>
              <span className="count-badge">{WATCHLIST.length}</span>
            </div>
            <div className="watchlist-list">
              {WATCHLIST.map(item => {
                const stock = STOCK_MAP.get(item.code);
                const quote = quotes.get(item.code);
                if (!stock) return null;
                return (
                  <div key={item.code} className="watch-card" onClick={() => openDetail(item.code)}>
                    {isAdmin && !READONLY && <button className="mini-remove" title="移除观察" onClick={(e) => { e.stopPropagation(); removeWatch(item.code); }}>×</button>}
                    <div className="watch-card-header">
                      <div>
                        <div className="watch-card-name">{stock.name} <span className="star">★</span></div>
                        <div className="watch-card-meta">{stock.code} · {stock.sector}</div>
                      </div>
                    </div>
                    <div className={`watch-card-price ${quote ? changeClass(quote.changePercent) : ''}`}>
                      {quote ? quote.price.toFixed(2) : '—'}
                    </div>
                    <div className={`watch-card-change ${quote ? changeClass(quote.changePercent) : ''}`}>
                      {quote ? `${quote.change > 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)` : '加载中…'}
                    </div>
                    <div className="watch-card-levels">
                      <div className="level-tag stop">
                        <span>止损</span><b>{item.stopLoss.toFixed(2)}</b>
                      </div>
                      <div className="level-tag support">
                        <span>支撑</span><b>{item.support.toFixed(2)}</b>
                      </div>
                      <div className="level-tag resistance">
                        <span>压力</span><b>{item.resistance.toFixed(2)}</b>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 价格预警 */}
          <section className="price-alert-section">
            <div className="section-heading-bar">
              <span className="heading-icon"><Icon.Bell /></span>
              <div>
                <h2>价格预警</h2>
                <p>监控 {PRICE_ALERTS.length} 只 · 实时检测</p>
              </div>
              <span className="count-badge">{PRICE_ALERTS.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {PRICE_ALERTS.map((alert, idx) => {
                const stock = STOCK_MAP.get(alert.code);
                const quote = quotes.get(alert.code);
                if (!stock) return null;
                const distance = quote ? Math.abs(quote.price - alert.target) / alert.target : 1;
                const triggered = distance < 0.015;
                const progressPct = quote ? Math.min(100, Math.max(0, (1 - distance) * 100 * 3)) : 0;
                return (
                  <div key={idx} className={`alert-card ${triggered ? 'triggered' : ''}`} onClick={() => openDetail(alert.code)}>
                    {isAdmin && !READONLY && <button className="mini-remove" title="移除预警" onClick={(e) => { e.stopPropagation(); removeAlert(alert.code); }}>×</button>}
                    <div className="alert-icon"><Icon.Bell /></div>
                    <div className="alert-info">
                      <div className="alert-name">{stock.name}</div>
                      <div className="alert-detail">
                        {stock.code} · {stock.sector} · {alert.note}
                        {quote && ` · 距离${alert.type === 'stop-loss' ? '止损' : alert.type === 'support' ? '支撑' : '压力'}约 ${(distance * 100).toFixed(1)}%`}
                      </div>
                      <div className="alert-progress">
                        <div
                          className="alert-progress-bar"
                          style={{
                            width: `${progressPct}%`,
                            background: triggered ? 'var(--up)' : alert.type === 'stop-loss' ? 'var(--down)' : 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>
                    <div className="alert-target">
                      <b className={changeClass(quote?.changePercent ?? 0)}>
                        {quote ? quote.price.toFixed(2) : '—'}
                      </b>
                      <span>目标 {alert.target.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 股票条目 */}
          <section className="results-section">
            <div className="results-heading">
              <h2>股票条目</h2>
              <span>共 {filteredStocks.length} 只 · 显示 {visibleStocks.length} 只</span>
            </div>
            {(activeTags.size > 0 || boardFilter !== 'all' || searchQuery) && (
              <div className="active-filters" style={{ marginBottom: 10 }}>
                {searchQuery && (
                  <span className="active-filter-chip">
                    搜索: {searchQuery}
                    <button onClick={() => setSearchQuery('')}>×</button>
                  </span>
                )}
                {[...activeTags].map(tag => (
                  <span key={tag} className="active-filter-chip">
                    {tag}
                    <button onClick={() => toggleTag(tag)}>×</button>
                  </span>
                ))}
                {boardFilter !== 'all' && (
                  <span className="active-filter-chip">
                    {boardFilter === 'sh-main' ? '沪市主板' :
                     boardFilter === 'sz-main' ? '深市主板' :
                     boardFilter === 'gem' ? '创业板' :
                     boardFilter === 'star' ? '科创板' :
                     boardFilter === 'bj' ? '北交所' : 'ST股'}
                    <button onClick={() => setBoardFilter('all')}>×</button>
                  </span>
                )}
              </div>
            )}
            <div className="stock-grid">
              {!dataReady &&
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="loading-card" />)}
              {visibleStocks.map(stock => {
                const quote = quotes.get(stock.code);
                const isWatched = WATCHLIST.some(w => w.code === stock.code);
                return (
                  <div key={stock.code} className="stock-card" onClick={() => openDetail(stock.code)}>
                    {isAdmin && !READONLY && (
                    <div className="stock-card-actions">
                      <button title="编辑" onClick={(e) => { e.stopPropagation(); openEdit(stock.code); }}>
                        <Icon.Edit />
                      </button>
                      <button title="删除" onClick={(e) => { e.stopPropagation(); deleteStock(stock.code); }}>
                        <Icon.Trash />
                      </button>
                    </div>
                    )}
                    <div className="stock-card-name">
                      <strong>{stock.name}</strong>
                      {isWatched && <span className="star">★</span>}
                    </div>
                    <div className="stock-card-code">{stock.code}</div>
                    <span className="stock-card-sector">{stock.sector}</span>
                    <div className="stock-card-price-row">
                      <span className={`stock-card-price ${quote ? changeClass(quote.changePercent) : ''}`}>
                        {quote ? quote.price.toFixed(2) : '—'}
                      </span>
                      <span className={`stock-card-change ${quote ? changeClass(quote.changePercent) : ''}`}>
                        {quote ? `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : ''}
                      </span>
                    </div>
                    {stock.note ? (
                      <div className="stock-card-note">{stock.note}</div>
                    ) : (
                      <div className="stock-card-note empty">暂无研究笔记</div>
                    )}
                  </div>
                );
              })}
            </div>
            {visibleStocks.length < filteredStocks.length && (
              <div className="load-more-wrap">
                <button className="secondary-button" onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}>
                  显示更多股票（剩余 {filteredStocks.length - visibleStocks.length} 只）
                </button>
              </div>
            )}
            {filteredStocks.length === 0 && quotes.size > 0 && (
              <div className="empty-state">
                <div className="empty-symbol">⌕</div>
                <h3>没有匹配的股票</h3>
                <p>试试减少筛选标签，或换一个关键词继续搜索。</p>
              </div>
            )}
          </section>

          <footer className="site-footer">
            <span>韭菜地图 · A股知识库</span>
            <p>股票行情仅供参考，请以交易所信息为准。投资有风险，入市需谨慎。</p>
          </footer>
        </div>
      </main>

      {/* ===== 详情面板 ===== */}
      <aside className={`detail-panel ${detailCode ? 'open' : ''}`}>
        <div className="detail-header">
          <button className="round-button" onClick={closeDetail} aria-label="关闭">
            <Icon.Back />
          </button>
          <span>股票详情</span>
        </div>
        {detailStock && (
          <div className="detail-content">
            <div className="detail-title">
              <h3>{detailStock.name}</h3>
              <div className="code">{detailStock.code}</div>
              <span className="sector-tag">{detailStock.sector}</span>
            </div>
            {isAdmin && !READONLY && (
            <div className="detail-actions">
              <button className="detail-action" onClick={() => openEdit(detailStock.code)}>
                <Icon.Edit /> 编辑资料
              </button>
              <button
                className="detail-action"
                onClick={() => toggleWatch(detailStock.code)}
              >
                {watchlist.some(w => w.code === detailStock.code) ? '移除观察' : '加入观察'}
              </button>
              <button
                className="detail-action"
                onClick={() => toggleAlert(detailStock.code)}
              >
                {alerts.some(a => a.code === detailStock.code) ? '移除预警' : '加入预警'}
              </button>
            </div>
            )}
            {detailQuote && (
              <>
                <div className="detail-price-block">
                  <span className={`detail-price ${changeClass(detailQuote.changePercent)}`}>
                    {detailQuote.price.toFixed(2)}
                  </span>
                  <span className={`detail-change ${changeClass(detailQuote.changePercent)}`}>
                    {detailQuote.change > 0 ? '+' : ''}{detailQuote.change.toFixed(2)} ({detailQuote.changePercent > 0 ? '+' : ''}{detailQuote.changePercent.toFixed(2)}%)
                  </span>
                </div>
                <div className="detail-grid">
                  <div className="detail-cell">
                    <label>今开</label>
                    <b className={changeClass(detailQuote.open - detailQuote.prevClose)}>{detailQuote.open.toFixed(2)}</b>
                  </div>
                  <div className="detail-cell">
                    <label>昨收</label>
                    <b>{detailQuote.prevClose.toFixed(2)}</b>
                  </div>
                  <div className="detail-cell">
                    <label>最高</label>
                    <b className="up">{detailQuote.high.toFixed(2)}</b>
                  </div>
                  <div className="detail-cell">
                    <label>最低</label>
                    <b className="down">{detailQuote.low.toFixed(2)}</b>
                  </div>
                  <div className="detail-cell">
                    <label>成交量</label>
                    <b>{formatVolume(detailQuote.volume)}手</b>
                  </div>
                  <div className="detail-cell">
                    <label>成交额</label>
                    <b>{formatMarketCap(detailQuote.amount)}</b>
                  </div>
                  <div className="detail-cell">
                    <label>换手率</label>
                    <b>{detailQuote.turnoverRate.toFixed(2)}%</b>
                  </div>
                  <div className="detail-cell">
                    <label>市盈率</label>
                    <b>{detailQuote.peRatio.toFixed(2)}</b>
                  </div>
                  <div className="detail-cell">
                    <label>振幅</label>
                    <b>{detailQuote.amplitude.toFixed(2)}%</b>
                  </div>
                  <div className="detail-cell">
                    <label>市净率</label>
                    <b>{detailQuote.pbRatio.toFixed(2)}</b>
                  </div>
                </div>
              </>
            )}
            {detailStock.note && (
              <div className="detail-note">
                <h4>研究笔记</h4>
                <p>{detailStock.note}</p>
              </div>
            )}
            {(() => {
              const watchItem = WATCHLIST.find(w => w.code === detailStock.code);
              if (!watchItem) return null;
              return (
                <div className="detail-note">
                  <h4>技术位</h4>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <div className="level-tag stop"><span>止损</span><b style={{ fontSize: 16 }}>{watchItem.stopLoss.toFixed(2)}</b></div>
                    <div className="level-tag support"><span>支撑</span><b style={{ fontSize: 16 }}>{watchItem.support.toFixed(2)}</b></div>
                    <div className="level-tag resistance"><span>压力</span><b style={{ fontSize: 16 }}>{watchItem.resistance.toFixed(2)}</b></div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </aside>

      {/* 遮罩 */}
      <button
        className={`panel-scrim ${detailCode ? 'show' : ''}`}
        onClick={closeDetail}
        aria-label="关闭详情"
      />

      {/* ===== 新增/编辑股票弹窗 ===== */}
      {modal && (
        <div className="modal-scrim" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'edit' ? '编辑股票' : '新增股票'}</h3>
              <button className="round-button" onClick={() => setModal(null)} aria-label="关闭">
                <Icon.Close />
              </button>
            </div>
            <div className="modal-body">
              <label>
                股票代码
                <input
                  value={formCode}
                  disabled={modal.mode === 'edit'}
                  onChange={e => setFormCode(e.target.value.trim())}
                  placeholder="如 sh600519 / sz000001"
                />
              </label>
              <label>
                股票名称
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="如 贵州茅台"
                />
              </label>
              <label>
                所属行业
                <select value={formSector} onChange={e => setFormSector(e.target.value)}>
                  {sectors.map(s => (
                    <option key={s.code} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label>
                研究笔记
                <textarea
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  rows={4}
                  placeholder="记录你的研究思路、关注点、买卖逻辑…"
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setModal(null)}>取消</button>
              <button className="primary-button" onClick={saveStock}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 管理员登录弹窗 */}
      {loginOpen && (
        <div className="modal-scrim" onClick={() => setLoginOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>管理员登录</h3>
              <button className="round-button" onClick={() => setLoginOpen(false)} aria-label="关闭">
                <Icon.Close />
              </button>
            </div>
            <div className="modal-body">
              <label>
                管理口令
                <input
                  type="password"
                  value={loginInput}
                  autoFocus
                  onChange={e => { setLoginInput(e.target.value); setLoginErr(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') doLogin(); }}
                  placeholder="请输入管理口令"
                />
              </label>
              {loginErr && <div className="login-error">{loginErr}</div>}
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setLoginOpen(false)}>取消</button>
              <button className="primary-button" onClick={doLogin}>登录</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-icon"><Icon.Bell /></span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
