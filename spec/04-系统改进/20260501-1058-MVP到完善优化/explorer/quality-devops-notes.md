---
type: exploration-notes
role: quality_devops_explorer
spec: 20260501-1058-MVP到完善优化
created: 2026-05-01
status: completed
scope:
  - backend/tests
  - frontend package scripts
  - docker-compose.yml
  - Dockerfile
  - render.yaml
  - pyproject.toml
  - README
  - .gitignore
---

# Quality / DevOps 探索笔记

> 本文件只记录质量、测试、构建、部署和可运维性探索结论。按用户约束，本轮只写本 notes 文件，不修改代码、不更新 TeamLead 控制面。

## 1. 当前验证和部署能力

### 后端验证能力

- `backend/pyproject.toml` 已配置后端核心依赖和 dev 测试依赖：
  - Runtime：FastAPI、uvicorn、SQLAlchemy async、asyncpg、Alembic、Pydantic、JWT、bcrypt、httpx。
  - Dev：`pytest`、`pytest-asyncio`、`httpx`。
  - `pytest` 配置仅有 `asyncio_mode = "auto"`，没有 coverage、markers、testpaths、超时或最小版本锁定。
- `backend/tests` 当前有 32 个 pytest 用例，覆盖：
  - 认证：注册、重复邮箱、登录、刷新 token、`/me`、角色切换、开通教师。
  - 教师：搜索、详情、公开可用时段、公开评价、重复创建 profile。
  - 预约：无时段拒绝、有余额下单、确认、取消退款、余额不足、开始/结束。
  - 评价：创建评价更新教师评分与课程状态、重复评价、非本人评价、未完成课评价。
  - 课堂消息/WebSocket：消息权限、WS 收发落库、无 token、伪造 token、非成员、非法 JSON、房间广播单元测试。
- 测试数据库固定为 `postgresql+asyncpg://cnvn:cnvn_secret@localhost:5432/cnvn_test`，依赖本机已有 PostgreSQL 和 `cnvn_test` 库。
- 测试 fixture 使用 `Base.metadata.create_all/drop_all` 建表，而不是 `alembic upgrade head`。这能快速跑 API 测试，但不会验证迁移链、触发器、seed 数据、downgrade 或真实部署启动行为。
- `backend/scripts/e2e_payment_test.py` 是支付 E2E 脚本，可在运行中 API + DB 上验证充值、下单、托管、完课、争议期释放、快照、出款、教师钱包到账和资金守恒；但它不是 pytest 套件的一部分，也没有被 CI 调度。

### 前端验证能力

- `frontend/package.json` 当前只有：
  - `dev`: `vite`
  - `build`: `vite build`
- 没有 `test`、`lint`、`typecheck`、`preview`、`e2e` 脚本。
- 仓库未发现前端测试配置或用例：没有 Vitest/Jest/Testing Library/Playwright 配置，也没有 `tsconfig` 或 ESLint 配置。
- `pnpm-lock.yaml` 存在，前端依赖可复现性强于后端。
- React / ReactDOM 放在 optional peerDependencies 中，而不是普通 dependencies；在当前本地安装下可能能运行，但作为产品化工程依赖声明不够清晰。

### 本地部署能力

- 根目录 `docker-compose.yml` 编排 `api + web + db`：
  - `api` 映射宿主 `8001 -> 8000`，使用 `uvicorn --reload`，挂载 `./backend/app:/app/app`，明确是开发态。
  - `web` 映射 `5173`，启动时执行 `pnpm install && pnpm exec vite --host 0.0.0.0 --port 5173`，也是开发态。
  - `db` 使用 `postgres:16-alpine`，有 `pg_isready` healthcheck。
- 本地 compose 能支撑开发联调，但不是生产部署形态：没有 API healthcheck、没有 web healthcheck、没有生产静态服务容器、没有迁移服务/一次性 job。

### 镜像和部署能力

- `backend/Dockerfile`：
  - 基于 `python:3.12-slim`，使用 `uv sync --no-dev --no-install-project` 安装依赖。
  - 复制代码后执行 `./start.sh`。
  - 后端 `.dockerignore` 排除了 tests、缓存和 `.env`，生产镜像体积与泄露风险较可控。
  - 但后端没有 `uv.lock`，镜像构建依赖版本不可完全复现。
- `backend/start.sh`：
  - 启动时先 `uv run alembic upgrade head`，再启动 uvicorn。
  - 优点是 Render 单实例部署简单；风险是应用启动和迁移耦合，多实例/重启/失败回滚场景不清晰。
- `frontend/Dockerfile`：
  - 基于 `node:22-alpine`，安装依赖后默认启动 Vite dev server。
  - 适合开发容器，不适合作为生产静态站点容器。
- `render.yaml`：
  - 后端使用 Docker runtime，配置 `/health`。
  - 前端使用 Render static runtime，构建命令为 `cd frontend && corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile && pnpm build`。
  - 数据库使用 Render free PostgreSQL，文件注释标明免费套餐有容量和 90 天限制；产品化阶段不应视为稳定生产数据库。

### 文档与忽略文件

- `backend/README.md` 记录了 compose 启动和迁移命令，但访问地址写的是 API docs `http://localhost:8000/docs`，与 compose 宿主端口 `8001` 不一致。
- `frontend/README.md` 仍是 Figma 导出模板文案，使用 `npm i` / `npm run dev`，与项目实际 pnpm 生态不一致。
- 根 `.gitignore` 已忽略 `frontend/node_modules`、`frontend/dist`、`.env*`、日志、Obsidian workspace；但未忽略 `backend/.pytest_cache`、`backend/**/__pycache__` 之外的更多 Python 工具缓存时可能仍产生本地噪声。

## 2. 测试覆盖缺口

### P0 覆盖缺口

1. **支付核心链路没有 pytest 自动化源文件**
   - 当前 `backend/tests` 下没有 `payment`、`payout`、`ledger`、`settlement`、`dispute` 相关测试文件。
   - 历史知识文档提到 `backend/tests/api/v1/test_payment_settlement.py`，但当前文件树中不存在。
   - 支付 E2E 脚本存在，但不属于标准测试套件。

2. **资金安全关键不变量没有纳入常规回归**
   - 资金守恒、托管账户、平台收入、税金、教师应付、教师钱包到账这些断言目前主要在 `scripts/e2e_payment_test.py` 中。
   - 应纳入 pytest 或 CI 调用，否则支付重构风险无法在 PR 阶段暴露。

3. **并发幂等未自动覆盖**
   - 历史支付测试报告已明确：`dispute_watcher.run_once` 使用 `FOR UPDATE SKIP LOCKED`，但并发场景未在 E2E 中实际并发跑。
   - 需要覆盖同一 `PaymentOrder` 重复 release、并发 watcher、多次 webhook replay、重复退款或重复下单。

4. **迁移链没有自动验证**
   - 当前 fixture 绕过 Alembic。
   - `002_add_payment_v2_tables.py` 包含账本 seed、不可变快照 trigger、教师税务资料回填；`003_drop_settlement.py` 删除旧 Lesson 结算字段。
   - 这些内容不会被 `Base.metadata.create_all` 测出来。

5. **前端没有自动化保障**
   - 没有前端 build 之外的类型检查、组件测试、关键页面 E2E。
   - 支付前端 spike 历史报告里付款单详情、教师 payout、VietQR 图片确认仍有未执行或部分执行项。

### P1 覆盖缺口

- API 权限矩阵不足：
  - `/payments/orders/{id}`：本人、教师、无关用户、未登录。
  - `/payouts/me`：教师、学生、未登录、分页、空列表。
  - 钱包流水分页、非法金额、边界金额。
- 状态机边界不足：
  - Lesson `pending_confirmation -> confirmed -> in_progress -> dispute_window/settled/reviewed` 的非法转移。
  - 24h 取消：>=24h 退款，<24h 不退款，时区边界。
- WebSocket 双客户端真实端到端不足：
  - 当前用单元测试验证广播；真实双连接端到端仍需要 Playwright 或专门 async WS client。
- 配置和安全测试不足：
  - 生产环境默认 secret/debug/mock channel fail-fast。
  - CORS origin 格式错误或为空时启动行为。
- 可观测性测试不足：
  - 错误响应是否有 request_id。
  - dispute watcher 异常重试是否可从日志/指标定位。

### P2 覆盖缺口

- 没有性能基准：
  - 教师搜索分页/排序。
  - `dispute_watcher.run_once(batch_size=100)`。
  - 钱包流水和账本查询。
- 没有依赖安全扫描、镜像扫描、许可证检查。
- 没有可访问性和移动端 smoke。

## 3. CI/CD、环境配置、日志、可观测性、数据迁移风险

### CI/CD 风险

- 仓库未发现 `.github/workflows`，当前没有自动 PR 闸门。
- 没有统一命令入口，例如：
  - backend test
  - backend migration check
  - frontend build/typecheck/lint/test
  - compose smoke
- 后端无 lockfile，CI 和生产镜像可能因依赖上游变化出现非确定性失败。
- 没有 artifact 保存策略：测试日志、coverage、Playwright trace、Docker build logs 均没有约定。

### 环境配置风险

- Python 版本存在漂移：
  - 项目规范写 Python 3.11。
  - `pyproject.toml` 是 `>=3.11`。
  - 后端 Dockerfile 和 Render env 使用 3.12。
- 默认配置偏开发：
  - `JWT_SECRET_KEY` 有默认弱值。
  - `APP_DEBUG` 默认 true。
  - `DEFAULT_PAYMENT_CHANNEL` 默认 mock。
  - `/docs`、`/redoc` 生产默认开启。
- Render 的 `CORS_ORIGINS` 和 `VITE_API_URL` 是 `sync: false`，需要部署后手动设置；如果漏配，前端 API 调用会失败或 CORS 拒绝。
- 前端 `API_BASE_URL` 默认 `http://localhost:8001`，生产静态站点若漏设 `VITE_API_URL` 会构建出错误 API 地址。

### 日志与可观测性风险

- 后端没有全局结构化日志配置。
- 没有 request_id/correlation_id，请求链路和支付状态流转难追踪。
- 只有 `dispute_watcher` 显式使用 logger；大多数业务 API/service 没有关键事件日志。
- 没有错误追踪（Sentry 等）、指标（Prometheus/OpenTelemetry）、慢查询日志、后台任务心跳或告警。
- `/health` 只返回静态 ok，不检查：
  - DB 连接。
  - 当前 Alembic revision。
  - dispute watcher 是否运行。
  - 外部支付渠道是否配置。

### 数据迁移风险

- 应用启动时自动跑 `alembic upgrade head`：
  - 单实例简单。
  - 多实例并发启动可能同时尝试迁移。
  - 迁移失败会阻断服务启动，但没有明确回滚和告警策略。
- 支付 v2 迁移涉及：
  - 创建 `ledger_accounts` 并 seed 四个系统户。
  - 创建 `ledger_entries`、`payment_orders`、`settlement_snapshots`、`payout_orders`、`teacher_tax_profiles`。
  - 创建 `settlement_snapshots` 禁止 UPDATE 的数据库 trigger。
  - 回填既有 TeacherProfile 的 TaxProfile。
  - 后续删除 Lesson 旧结算字段。
- 当前测试 fixture 绕过这些迁移，不能保证：
  - 空库升级成功。
  - 老库升级成功。
  - seed 幂等。
  - trigger 生效。
  - downgrade 可用。
  - 模型定义与迁移结果一致。

## 4. P0 / P1 / P2 质量与 DevOps 优化建议

### P0：进入产品化前必须补齐

1. **建立 PR CI 最小闸门**
   - PostgreSQL 16 service。
   - `cd backend && uv sync --extra dev && uv run alembic upgrade head`。
   - `cd backend && uv run pytest tests -q`。
   - 支付 E2E 脚本纳入 CI，或改写为 pytest。
   - `cd frontend && corepack enable && pnpm install --frozen-lockfile && pnpm build`。

2. **支付资金链路 pytest 化**
   - 把 `backend/scripts/e2e_payment_test.py` 的关键断言沉淀为 pytest 集成测试。
   - 每个资金状态变化后断言资金守恒。
   - 覆盖 release/refund/webhook/retry/concurrency。

3. **迁移测试独立化**
   - 增加空库 `alembic upgrade head` 测试。
   - 增加 `alembic current` 或 revision 断言。
   - 验证 `ledger_accounts` seed 和 `settlement_snapshots` no-update trigger。

4. **生产配置 fail-fast**
   - `APP_ENV=production` 时禁止默认 JWT secret。
   - 禁止 `APP_DEBUG=true`。
   - 必须显式配置 CORS。
   - 若真实支付未接入，应明确 mock channel 的环境边界。

5. **修正文档与启动说明**
   - README API docs 端口应与 compose 的 `8001` 对齐。
   - frontend README 应从 Figma 模板改成项目实际 pnpm/Vite 说明。

### P1：建议本 Spec 一并纳入

1. **前端工程质量基础设施**
   - 增加 `tsconfig`。
   - 增加 `typecheck`、`lint`、`test`、`preview` 脚本。
   - 将 React/ReactDOM 明确放入 dependencies。
   - 增加 Playwright smoke：登录、教师列表、钱包、付款单、payout、课堂入口。

2. **迁移与启动职责拆分**
   - 将迁移从 Web 进程启动中拆到 deploy job / release command。
   - 如果短期保留启动自动迁移，至少在文档里标明单实例假设，并在 CI 验证重复运行安全。

3. **可观测性最小闭环**
   - 请求日志：method、path、status、latency、request_id。
   - 支付事件日志：order_id、lesson_id、user_id、from_status、to_status、amount、error。
   - 后台任务日志：processed、failed、retry_count、duration。
   - `/healthz` 检查 DB；`/readyz` 检查迁移 revision。

4. **测试数据与 fixture 改造**
   - 为支付/预约/教师建立工厂函数，减少重复注册/登录样板。
   - 用 Alembic 初始化测试库，或保留快速 create_all 套件同时增加 migration 套件。

5. **Compose smoke**
   - 给 `api` 加 healthcheck。
   - 给 `web` 加 smoke 或至少构建型服务。
   - 增加 `docker compose exec api uv run alembic current` 和 `/health` 验证步骤。

### P2：后续产品化增强

- 依赖与镜像安全扫描：pip/audit、pnpm audit、Docker image scan。
- 覆盖率门槛：先从支付新模块设门槛，再逐步扩大。
- 性能基线：教师搜索、支付 release batch、钱包流水分页。
- 日志采集和告警：Render logs 之外增加异常聚合与后台任务失败告警。
- 增加 staging 环境和数据库备份/恢复演练。
- Render free database 不应承载真实用户生产数据，需规划持久化付费实例或其他云数据库。

## 5. 最小测试矩阵建议

### PR 必跑矩阵

| 层级 | 命令/动作 | 目标 |
|------|-----------|------|
| Backend migration | `alembic upgrade head` on empty PostgreSQL 16 | 迁移链可部署 |
| Backend API | `pytest backend/tests -q` | 现有认证/教师/预约/评价/课堂回归 |
| Payment integration | pytest 化支付 E2E 或 `python -m scripts.e2e_payment_test` | 资金主链路和守恒 |
| Frontend build | `pnpm install --frozen-lockfile && pnpm build` | 静态构建可发布 |
| Docker smoke | `docker compose up --build` + `/health` + 前端首页 | 本地编排可启动 |

### 支付专项矩阵

| 场景 | 必要断言 |
|------|----------|
| Topup | 钱包余额增加；Transaction 写入；资金守恒 |
| Lesson order | 学员扣款；PaymentOrder held；escrow 增加；重复下单被拒 |
| Cancel >= 24h | refund；钱包返还；PaymentOrder refunded；资金守恒 |
| Cancel < 24h | 取消但不退款；资金留在托管或按业务规则处理 |
| End lesson | Lesson 进入争议期；held_until 写入；无提前 release |
| Release | Snapshot 不可变；账本拆分正确；PayoutOrder paid；教师钱包到账 |
| Webhook replay | 重复回调无重复入账 |
| Concurrent release | 多 worker/多请求下每单只释放一次 |
| Payout API | 教师只能看自己的 payout；学生/无关用户 403 |

### 前端 E2E Smoke 矩阵

| 页面/流程 | 核心验证 |
|-----------|----------|
| 注册/登录 | token 写入、本地跳转、错误提示 |
| 教师列表/详情 | API 加载、空态、详情、可用时段和评价 |
| 学员 dashboard | upcoming/past/wallet 加载 |
| 钱包 | 余额、充值、流水、VietQR 图片 |
| 付款单详情 | 合法订单展示；无权限错误态 |
| 教师中心/出款 | 教师角色可访问；学生被引导 |
| 课堂 | REST 历史消息 + WebSocket 连接/错误态 |

### 发布前手动/半自动矩阵

- 清洁数据库首次部署：后端迁移成功，`/health` 返回 ok，前端能访问 API。
- 已有数据库滚动部署：重复启动不会重复 seed 或破坏迁移。
- 生产环境变量检查：`JWT_SECRET_KEY`、`CORS_ORIGINS`、`VITE_API_URL`、`APP_DEBUG=false`。
- Render blueprint dry run：后端 service、前端 static、数据库连接均正确。
- 备份恢复演练：至少对支付相关表做一次 dump/restore 验证。

## 6. 下游交接重点

- 给 spec-writer：
  - 本 Spec 的质量主线应先补 P0：CI、支付自动化、迁移验证、生产配置 fail-fast。
  - 前端质量体系属于 P1，但如果要产品化对外试运营，至少要有 build + Playwright smoke。
  - 不建议在 Web 进程启动中长期承担迁移职责；短期可接受，但需写清单实例假设和重复运行验证。
- 给 spec-tester：
  - 测试计划必须把支付资金守恒和并发幂等列为阻断级验收。
  - 不要只跑现有 `pytest tests`，因为它覆盖不到支付 v2 的核心风险。
  - 迁移测试应使用 PostgreSQL 16，不要用 SQLite 替代。

