# 韭菜地图 · A股知识库

> 一个模仿 [xiaojiucai.top](https://xiaojiucai.top/) 的 A 股股票知识库 / 研究工具，将全市场股票按行业、关键词与走势线索组织起来，帮助你快速找到研究方向。

⚠️ 本项目仅供学习交流，所有数据来自公开行情接口，不构成任何投资建议。

## 功能特性

- **三栏布局**：侧边栏（行业标签筛选）+ 主内容区 + 右侧详情滑出面板
- **全局搜索**：按代码 / 名称 / 行业 / 关键词 / 笔记模糊匹配，支持 `/` 快捷键聚焦
- **多维筛选**：31 个申万一级行业标签多选组合 + 板块（沪市 / 深市 / 创业板 / 科创板 / 北交所 / ST）+ 排序（涨跌 / 名称 / 代码）
- **重点观察**：星标股票，含止损 / 支撑 / 压力位、实时价格与涨跌幅
- **价格预警**：接近目标价（< 1.5%）自动触发 Toast 通知
- **股票详情**：10+ 项行情数据（开 / 收 / 高 / 低 / 量 / 额 / 换手率 / PE / PB / 振幅）
- **实时行情**：接入腾讯公开行情接口，交易时段每 30 秒刷新
- **数据可编辑**：页面内即可新增 / 编辑 / 删除股票、写研究笔记（落盘持久化）
- **权限控制**：访客只读浏览；管理员口令登录后可编辑

## 技术栈

- **框架**：Next.js 14（App Router）+ TypeScript
- **样式**：纯手写 CSS（无 UI 框架依赖）
- **数据源**：腾讯公开行情接口 `qt.gtimg.cn`（经 Next.js API 路由代理，GBK 解码）
- **存储**：`data/stocks.json` 文件存储（无需数据库）

## 目录结构

```
jiucai/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 主页面（所有交互逻辑）
│   │   ├── globals.css             # 全局样式
│   │   └── api/
│   │       ├── quote/route.ts      # 行情代理（腾讯接口 + GBK 解码）
│   │       ├── search/route.ts     # 搜索
│   │       ├── data/               # 数据 CRUD 接口
│   │       └── admin/login/        # 管理员登录
│   ├── lib/
│   │   ├── types.ts                # 类型定义
│   │   ├── stockData.ts            # 预置种子数据（144 只 / 31 行业）
│   │   ├── store.ts                # 数据读写（JSON 落盘）
│   │   └── auth.ts                 # 管理员口令校验
├── data/
│   └── stocks.json                 # 运行时数据（首次启动从种子生成）
├── .env.local                      # 本地环境变量（已被 gitignore，勿提交）
└── .github/workflows/ci.yml        # CI：push 后自动构建校验
```

## 快速开始（本地开发）

```bash
# 1. 安装依赖
npm install

# 2.（可选）配置管理员口令，见下方「权限配置」
#    编辑 .env.local，设置 ADMIN_TOKEN

# 3. 启动开发服务器
npm run dev
# 默认 http://localhost:3000
```

## 权限配置（重要）

项目区分**访客**与**管理员**：

- **访客**：只能浏览，看不到任何编辑按钮；直接调用写接口会被后端 `403` 拦截。
- **管理员**：在页面右上角点「管理登录」输入口令后，可新增 / 编辑 / 删除股票、写笔记。

配置方式：在项目根目录创建 `.env.local`（已被 `.gitignore` 忽略，不会提交）：

```bash
# .env.local
ADMIN_TOKEN=你的强口令
```

> ⚠️ 修改口令后**必须重启服务**才生效。请使用足够强的口令，并妥善保管。

## 部署

### 生产构建运行（推荐）

```bash
npm install
npm run build
npm start
# 默认 http://localhost:3000，可用 -p 指定端口，或用反向代理 / 进程管理器托管
```

### 权限说明

- 读接口（`GET /api/data`、`/api/quote`、`/api/search`）公开，浏览必需。
- 写接口（`/api/data/stocks` 等 POST/PUT/DELETE）需 `Authorization: Bearer <ADMIN_TOKEN>`，不符返回 `403`。
- 前端编辑 UI 仅在管理员登录后可见；但**真安全靠后端校验**，访客即使手动拼请求也会被拒。

### 数据持久化

- 所有编辑落盘到 `data/stocks.json`。
- **自有服务器 / VPS**：确保该目录可写，建议定期备份。
- **Docker**：必须给 `/app/data` 挂载 volume，否则容器重建数据丢失。
- **Vercel / Serverless（无持久磁盘）**：当前文件存储方案不可用，需改用数据库（如 Postgres / Supabase）。

## CI

仓库已配置 GitHub Actions（`.github/workflows/ci.yml`）：每次向 `main` 推送或发起 PR 时，自动 `npm ci` 并执行 `npm run build` 校验构建是否通过。

## 免责声明

本项目仅供学习与技术交流，所有行情数据来自公开接口，可能存在延迟或误差。
**不构成任何投资建议**，据此操作风险自担。
