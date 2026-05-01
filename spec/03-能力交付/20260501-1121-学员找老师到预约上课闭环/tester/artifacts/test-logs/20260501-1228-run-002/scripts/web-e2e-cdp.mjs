import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const runDir = path.dirname(scriptsDir);

const RUN_ID = "20260501-1228-run-002";
const DB_NAME = "cnvn_e2e_20260501_1228_run_002";
const API = "http://127.0.0.1:8002";
const WEB = "http://127.0.0.1:5174";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DEBUG_PORT = 9222;

const auditPath = path.join(runDir, "audit.log");
const consolePath = path.join(runDir, "browser-console.ndjson");
const networkPath = path.join(runDir, "network-summary.json");
const apiSummaryPath = path.join(runDir, "api-summary.json");
const domSummaryPath = path.join(runDir, "dom-summary.json");
const userFlowPath = path.join(runDir, "user-flow.md");
const setupSqlPath = path.join(runDir, "setup-sql.log");
const failurePath = path.join(runDir, "failure-trace.txt");
const screenshotsDir = path.join(runDir, "screenshots");
const chromeProfileDir = path.join(runDir, "chrome-profile");

fs.mkdirSync(screenshotsDir, { recursive: true });
for (const p of [auditPath, consolePath, userFlowPath, setupSqlPath]) {
  fs.writeFileSync(p, "", "utf8");
}
fs.rmSync(failurePath, { force: true });

const networkEvents = [];
const apiEvents = [];
const domSummaries = [];
const flowLines = [];
let currentCase = "SETUP";

function now() {
  return new Date().toISOString();
}

function append(file, text) {
  fs.appendFileSync(file, text, "utf8");
}

function audit(event, data = {}) {
  append(auditPath, `${JSON.stringify({ ts: now(), run_id: RUN_ID, case_id: currentCase, event, ...data })}\n`);
}

function flow(line) {
  flowLines.push(`- ${now()} [${currentCase}] ${line}`);
  fs.writeFileSync(userFlowPath, `# Web E2E User Flow\n\n${flowLines.join("\n")}\n`, "utf8");
}

function sanitizeUrl(url) {
  const u = new URL(url, API);
  u.searchParams.delete("access_token");
  u.searchParams.delete("token");
  return `${u.pathname}${u.search || ""}`;
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 4)}***@${domain}`;
}

async function apiFetch(pathname, options = {}, token) {
  const started = performance.now();
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}/api/v1${pathname}`, { ...options, headers });
  const durationMs = Math.round(performance.now() - started);
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  apiEvents.push({
    ts: now(),
    case_id: currentCase,
    method: options.method || "GET",
    url: sanitizeUrl(`/api/v1${pathname}`),
    status: res.status,
    duration_ms: durationMs,
  });
  if (!res.ok) {
    throw new Error(`API ${options.method || "GET"} ${pathname} failed: ${res.status} ${text}`);
  }
  return body;
}

async function registerLogin(label) {
  const suffix = `${RUN_ID.replaceAll("-", "")}_${label}_${crypto.randomBytes(3).toString("hex")}`;
  const email = `e2e_${suffix}@example.test`;
  const password = `Pass_${crypto.randomBytes(8).toString("hex")}`;
  const fullName = `E2E ${label}`;
  await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  const login = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  audit("account.created", { role: label, email: maskEmail(email) });
  return { email, password, fullName, token: login.access_token };
}

async function createTeacher() {
  const teacher = await registerLogin("teacher");
  const titleMarker = `${RUN_ID}-${crypto.randomBytes(3).toString("hex")}`;
  const title = `端侧证据中文老师 ${titleMarker}`;
  await apiFetch(
    "/auth/become-teacher",
    {
      method: "POST",
      body: JSON.stringify({
        title,
        about: "仅用于本次端侧补充验证的测试教师。",
        hourly_rate: 60000,
        currency: "VND",
        teacher_type: "professional",
        specialties: ["口语", "HSK"],
      }),
    },
    teacher.token,
  );
  const listed = await apiFetch(`/teachers?q=${encodeURIComponent(titleMarker)}&page_size=100`);
  const profile = listed.items.find((item) => item.title.includes(titleMarker));
  if (!profile) throw new Error("Teacher profile was not found after become-teacher");
  return { ...teacher, teacherId: profile.id, title };
}

function vnDateOffset(days) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  return `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}-${parts.find((p) => p.type === "day").value}`;
}

async function createAvailability(teacher, day) {
  await apiFetch(
    "/availability",
    {
      method: "POST",
      body: JSON.stringify({
        specific_date: day,
        start_time: "09:00:00",
        end_time: "21:00:00",
        is_recurring: false,
      }),
    },
    teacher.token,
  );
}

function psql(sql) {
  const output = execFileSync(
    "docker",
    ["exec", "cnvn-db", "psql", "-U", "cnvn", "-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  );
  append(setupSqlPath, `-- ${now()}\n${output}\n`);
  return output;
}

function ensureLedgerAccounts() {
  psql(`
    INSERT INTO ledger_accounts (id, code, name, balance, created_at)
    VALUES
      ('${crypto.randomUUID()}', 'escrow', '托管账户', 0, now()),
      ('${crypto.randomUUID()}', 'platform_revenue', '平台收入账户', 0, now()),
      ('${crypto.randomUUID()}', 'tax_payable', '税费应付账户', 0, now()),
      ('${crypto.randomUUID()}', 'teacher_payable', '教师应付账户', 0, now())
    ON CONFLICT (code) DO NOTHING;
  `);
}

function insertMatrixLessons(studentId, teacherId) {
  const rows = [
    ["pending_confirmation", "矩阵-待老师确认", "now() + interval '3 days'"],
    ["confirmed", "矩阵-待上课", "now() + interval '4 days'"],
    ["confirmed", "矩阵-可进入课堂", "now() + interval '5 minutes'"],
    ["in_progress", "矩阵-进行中", "now() - interval '30 minutes'"],
    ["completed", "矩阵-已完成", "now() - interval '5 hours'"],
    ["reviewed", "矩阵-已评价", "now() - interval '7 hours'"],
    ["cancelled", "矩阵-已取消", "now() + interval '6 days'"],
    ["expired", "矩阵-已过期", "now() + interval '6 days'"],
  ];
  const values = rows
    .map(([status, topic, offset]) => {
      const id = crypto.randomUUID();
      return `('${id}', '${studentId}', '${teacherId}', ${offset}, 30, '${topic}', '${status}', 30000, now(), now(), ${status === "in_progress" ? "now() - interval '30 minutes'" : "NULL"}, ${status === "completed" || status === "reviewed" ? "now() - interval '4 hours'" : "NULL"})`;
    })
    .join(",\n");
  psql(`
    INSERT INTO lessons (
      id, student_id, teacher_id, scheduled_at, duration_minutes, topic, status,
      price, created_at, updated_at, actual_start_at, actual_end_at
    )
    VALUES ${values};
  `);
}

function getUserIdByEmail(email) {
  const output = psql(`SELECT id FROM users WHERE email = '${email.replaceAll("'", "''")}';`);
  const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!match) throw new Error(`Could not find user id for ${maskEmail(email)}`);
  return match[0];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, label, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
      last = value;
    } catch (e) {
      last = e;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${label}; last=${last instanceof Error ? last.message : JSON.stringify(last)}`);
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
        return;
      }
      const handlers = this.handlers.get(msg.method) || [];
      for (const handler of handlers) handler(msg.params || {});
    });
  }
  on(method, handler) {
    const handlers = this.handlers.get(method) || [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }
  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000);
    });
  }
  close() {
    this.ws.close();
  }
}

async function getJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function connectChrome() {
  fs.rmSync(chromeProfileDir, { recursive: true, force: true });
  fs.mkdirSync(chromeProfileDir, { recursive: true });
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${chromeProfileDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,1000",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", (chunk) => append(path.join(runDir, "chrome.stderr.log"), chunk.toString()));
  await waitFor(async () => {
    try {
      const v = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      return Boolean(v.webSocketDebuggerUrl);
    } catch {
      return false;
    }
  }, "Chrome remote debugging");
  const target = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(`${WEB}/`)}`, { method: "PUT" });
  const page = new CDPClient(target.webSocketDebuggerUrl);
  await page.ready;
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Network.enable");
  await page.send("Page.setLifecycleEventsEnabled", { enabled: true });

  page.on("Runtime.consoleAPICalled", (params) => {
    append(consolePath, `${JSON.stringify({ ts: now(), case_id: currentCase, type: params.type, args: (params.args || []).map((a) => a.value ?? a.description ?? a.type) })}\n`);
  });
  page.on("Runtime.exceptionThrown", (params) => {
    append(consolePath, `${JSON.stringify({ ts: now(), case_id: currentCase, type: "exception", text: params.exceptionDetails?.text, exception: params.exceptionDetails?.exception?.description })}\n`);
  });
  const requests = new Map();
  page.on("Network.requestWillBeSent", (params) => {
    requests.set(params.requestId, {
      ts: now(),
      case_id: currentCase,
      method: params.request.method,
      url: sanitizeUrl(params.request.url),
      started: performance.now(),
      type: params.type,
    });
  });
  page.on("Network.responseReceived", (params) => {
    const req = requests.get(params.requestId);
    if (!req) return;
    networkEvents.push({
      ts: req.ts,
      case_id: req.case_id,
      method: req.method,
      url: req.url,
      status: params.response.status,
      type: req.type,
      duration_ms: Math.round(performance.now() - req.started),
      error: null,
    });
  });
  page.on("Network.loadingFailed", (params) => {
    const req = requests.get(params.requestId);
    if (!req) return;
    networkEvents.push({
      ts: req.ts,
      case_id: req.case_id,
      method: req.method,
      url: req.url,
      status: null,
      type: req.type,
      duration_ms: Math.round(performance.now() - req.started),
      error: params.errorText,
    });
  });
  page.on("Network.webSocketCreated", (params) => {
    networkEvents.push({
      ts: now(),
      case_id: currentCase,
      method: "WS",
      url: sanitizeUrl(params.url),
      status: "created",
      type: "WebSocket",
      duration_ms: 0,
      error: null,
    });
  });
  return { chrome, page };
}

async function navigate(page, url) {
  await page.send("Page.navigate", { url });
  await sleep(1000);
  await waitFor(async () => {
    const r = await page.send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
    return r.result.value === "complete";
  }, `page load ${url}`);
  await sleep(600);
}

async function evaluate(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function setAuth(page, token) {
  await navigate(page, WEB);
  await evaluate(page, `localStorage.setItem("cnvn_access_token", ${JSON.stringify(token)}); localStorage.removeItem("access_token"); true;`);
}

async function screenshot(page, name) {
  const shot = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const file = path.join(screenshotsDir, name);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  audit("screenshot", { file: `screenshots/${name}` });
  return file;
}

async function captureDom(page, name) {
  const data = await evaluate(page, `(() => {
    const text = document.body.innerText.replace(/\\s+/g, " ").slice(0, 2500);
    const buttons = [...document.querySelectorAll("button,a")].map((el) => el.textContent.trim()).filter(Boolean).slice(0, 80);
    const location = window.location.pathname + window.location.search;
    return { location, title: document.title, text, buttons };
  })()`);
  domSummaries.push({ ts: now(), case_id: currentCase, name, ...data });
  fs.writeFileSync(domSummaryPath, JSON.stringify({ run_id: RUN_ID, summaries: domSummaries }, null, 2), "utf8");
  return data;
}

async function chooseSlotAndSubmit(page, scheduledAt, topic) {
  const ok = await evaluate(page, `(() => {
    const slot = ${JSON.stringify(scheduledAt)};
    const topic = ${JSON.stringify(topic)};
    const selects = [...document.querySelectorAll("select")];
    const slotSelect = selects.find((s) => [...s.options].some((o) => o.value === slot));
    if (!slotSelect) return { ok: false, reason: "slot select not found", options: selects.map((s) => [...s.options].map((o) => o.value).slice(0, 5)) };
    const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    selectSetter.call(slotSelect, slot);
    slotSelect.dispatchEvent(new Event("input", { bubbles: true }));
    slotSelect.dispatchEvent(new Event("change", { bubbles: true }));
    const textarea = document.querySelector("textarea");
    if (textarea) {
      const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      textareaSetter.call(textarea, topic);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("预约试课"));
    if (!button) return { ok: false, reason: "submit button not found" };
    button.click();
    return { ok: true };
  })()`);
  if (!ok.ok) throw new Error(`Could not submit booking: ${JSON.stringify(ok)}`);
}

async function clickByText(page, selector, text, { exact = false } = {}) {
  const clicked = await evaluate(page, `(() => {
    const exact = ${JSON.stringify(exact)};
    const wanted = ${JSON.stringify(text)};
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => {
      const value = node.textContent.trim();
      return !node.disabled && (exact ? value === wanted : value.includes(wanted));
    });
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not click ${selector} containing ${text}`);
}

async function run() {
  audit("run.start", { api: API, web: WEB });
  ensureLedgerAccounts();
  const teacher = await createTeacher();
  const studentSuccess = await registerLogin("student-success");
  const studentRecover = await registerLogin("student-recover");
  const studentMatrix = await registerLogin("student-matrix");

  const daySuccess = vnDateOffset(7);
  const dayRecover = vnDateOffset(8);
  await createAvailability(teacher, daySuccess);
  await createAvailability(teacher, dayRecover);
  await apiFetch("/wallet/topup", { method: "POST", body: JSON.stringify({ amount: 500000 }) }, studentSuccess.token);
  const matrixStudentId = getUserIdByEmail(studentMatrix.email);
  insertMatrixLessons(matrixStudentId, teacher.teacherId);

  const data = {
    run_id: RUN_ID,
    teacher: { id: teacher.teacherId, title: teacher.title },
    accounts: {
      teacher: maskEmail(teacher.email),
      student_success: maskEmail(studentSuccess.email),
      student_recover: maskEmail(studentRecover.email),
      student_matrix: maskEmail(studentMatrix.email),
    },
    slots: {
      us001: `${daySuccess}T09:00:00+07:00`,
      us002: `${dayRecover}T10:00:00+07:00`,
    },
    lessons: {},
  };

  const { chrome, page } = await connectChrome();
  try {
    currentCase = "US-001";
    flow("登录有余额学员，打开教师详情并通过页面提交预约。");
    await setAuth(page, studentSuccess.token);
    await navigate(page, `${WEB}/teachers/${teacher.teacherId}`);
    await captureDom(page, "us001-teacher-profile-before-submit");
    await screenshot(page, "us001-01-teacher-profile.png");
    await chooseSlotAndSubmit(page, data.slots.us001, "US-001 端侧预约成功");
    await waitFor(async () => {
      const loc = await evaluate(page, "window.location.pathname");
      return loc === "/dashboard/student";
    }, "US-001 dashboard navigation");
    await waitFor(async () => {
      const text = await evaluate(page, "document.body.innerText");
      return text.includes("待老师确认") && text.includes("US-001 端侧预约成功");
    }, "US-001 pending lesson visible");
    await screenshot(page, "us001-02-dashboard-pending.png");
    const us001Dom = await captureDom(page, "us001-dashboard-pending");
    const lessons1 = await apiFetch("/lessons?role=student&page=1&page_size=100", {}, studentSuccess.token);
    const lesson1 = lessons1.items.find((item) => item.topic === "US-001 端侧预约成功");
    if (!lesson1 || lesson1.status !== "pending_confirmation") throw new Error("US-001 lesson was not pending_confirmation");
    data.lessons.us001_pending = lesson1.id;
    audit("case.pass", { assertion: "dashboard shows pending_confirmation", dom_location: us001Dom.location });

    currentCase = "US-002";
    flow("登录余额不足学员，教师详情提交预约后进入钱包，充值后返回教师页继续提交。");
    await setAuth(page, studentRecover.token);
    await navigate(page, `${WEB}/teachers/${teacher.teacherId}`);
    await chooseSlotAndSubmit(page, data.slots.us002, "US-002 余额不足恢复预约");
    await waitFor(async () => {
      const loc = await evaluate(page, "window.location.pathname + window.location.search");
      return loc.includes("/wallet") && loc.includes("intent=booking");
    }, "US-002 wallet redirect");
    await waitFor(async () => {
      const text = await evaluate(page, "document.body.innerText");
      return text.includes("充值后返回继续预约");
    }, "US-002 wallet booking hint");
    await screenshot(page, "us002-01-wallet-before-topup.png");
    await captureDom(page, "us002-wallet-before-topup");
    await clickByText(page, "button", "充值", { exact: true });
    await waitFor(async () => {
      const text = await evaluate(page, "document.body.innerText");
      return text.includes("返回继续预约");
    }, "US-002 return button enabled");
    await screenshot(page, "us002-02-wallet-after-topup.png");
    await clickByText(page, "button", "返回继续预约");
    await waitFor(async () => {
      const text = await evaluate(page, "document.body.innerText");
      return windowPathLike(await evaluate(page, "window.location.pathname"), `/teachers/${teacher.teacherId}`) && text.includes("已恢复上次未完成的预约草稿");
    }, "US-002 draft restored on teacher profile");
    await screenshot(page, "us002-03-draft-restored.png");
    await chooseSlotAndSubmit(page, data.slots.us002, "US-002 余额不足恢复预约");
    await waitFor(async () => {
      const loc = await evaluate(page, "window.location.pathname");
      return loc === "/dashboard/student";
    }, "US-002 dashboard navigation after recovery");
    await waitFor(async () => {
      const text = await evaluate(page, "document.body.innerText");
      return text.includes("待老师确认") && text.includes("US-002 余额不足恢复预约");
    }, "US-002 recovered lesson visible");
    await screenshot(page, "us002-04-dashboard-pending-after-recovery.png");
    await captureDom(page, "us002-dashboard-after-recovery");
    const lessons2 = await apiFetch("/lessons?role=student&page=1&page_size=100", {}, studentRecover.token);
    const recovered = lessons2.items.find((item) => item.topic === "US-002 余额不足恢复预约");
    if (!recovered || recovered.status !== "pending_confirmation") throw new Error("US-002 recovered lesson missing");
    data.lessons.us002_recovered = recovered.id;
    audit("case.pass", { assertion: "insufficient-balance recovery creates lesson after topup only" });

    currentCase = "US-003";
    flow("登录课程矩阵学员，打开学员中心验证状态分组和课堂入口规则。");
    await setAuth(page, studentMatrix.token);
    await navigate(page, `${WEB}/dashboard/student`);
    await waitFor(async () => {
      const text = await evaluate(page, "document.body.innerText");
      return ["待老师确认", "待上课", "进行中", "已完成", "已取消/已过期"].every((s) => text.includes(s));
    }, "US-003 lesson groups");
    const us003Dom = await captureDom(page, "us003-dashboard-state-groups");
    if (!us003Dom.text.includes("等待老师确认") || !us003Dom.text.includes("课程已完成") || !us003Dom.text.includes("进入教室")) {
      throw new Error("US-003 dashboard did not expose expected reasons or classroom entry");
    }
    await screenshot(page, "us003-01-dashboard-state-groups.png");
    audit("case.pass", { assertion: "state groups and classroom entry rules visible" });

    currentCase = "US-004";
    flow("直接访问 pending 课程课堂，验证页面显示阻断原因，且未请求消息历史或建立 WebSocket。");
    await setAuth(page, studentSuccess.token);
    const beforeNetworkCount = networkEvents.length;
    await navigate(page, `${WEB}/classroom/${data.lessons.us001_pending}`);
    await waitFor(async () => {
      const text = await evaluate(page, "document.body.innerText");
      return text.includes("暂时不能进入课堂") && text.includes("等待老师确认");
    }, "US-004 classroom blocked reason");
    await screenshot(page, "us004-01-classroom-blocked.png");
    await captureDom(page, "us004-classroom-blocked");
    const us004Network = networkEvents.slice(beforeNetworkCount).filter((e) => e.case_id === "US-004");
    const badEntry = us004Network.find((e) => e.url.includes("/messages") || (e.type === "WebSocket" && e.url.includes("/api/v1/lessons/")));
    if (badEntry) throw new Error(`US-004 unexpectedly entered classroom transport: ${JSON.stringify(badEntry)}`);
    audit("case.pass", { assertion: "blocked classroom without messages or WebSocket" });

    data.case_results = {
      "US-001": "passed",
      "US-002": "passed",
      "US-003": "passed",
      "US-004": "passed",
    };
    fs.writeFileSync(apiSummaryPath, JSON.stringify({ run_id: RUN_ID, api_events: apiEvents, data }, null, 2), "utf8");
    fs.writeFileSync(networkPath, JSON.stringify({ run_id: RUN_ID, requests: networkEvents }, null, 2), "utf8");
    audit("run.pass", { cases: Object.keys(data.case_results) });
  } finally {
    page.close();
    chrome.kill();
    await sleep(500);
    fs.rmSync(chromeProfileDir, { recursive: true, force: true });
  }
}

function windowPathLike(actual, expected) {
  return actual === expected;
}

run().catch((error) => {
  const message = error?.stack || error?.message || String(error);
  fs.writeFileSync(failurePath, message, "utf8");
  fs.writeFileSync(apiSummaryPath, JSON.stringify({ run_id: RUN_ID, api_events: apiEvents }, null, 2), "utf8");
  fs.writeFileSync(networkPath, JSON.stringify({ run_id: RUN_ID, requests: networkEvents }, null, 2), "utf8");
  audit("run.fail", { message: error?.message || String(error) });
  process.exitCode = 1;
});
