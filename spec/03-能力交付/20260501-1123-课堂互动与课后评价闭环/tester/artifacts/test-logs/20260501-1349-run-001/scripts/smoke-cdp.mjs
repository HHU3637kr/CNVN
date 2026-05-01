import fs from "node:fs";
import path from "node:path";

const logDir = process.env.LOG_DIR;
const runId = process.env.RUN_ID;
const cdpPort = process.env.CDP_PORT || "9223";
const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:8002";
const webBase = process.env.WEB_BASE_URL || "http://127.0.0.1:5174";
if (!logDir || !runId) throw new Error("LOG_DIR and RUN_ID are required");

const consolePath = path.join(logDir, "browser-console.ndjson");
const consoleDirPath = path.join(logDir, "console", "browser-console.ndjson");
const networkPath = path.join(logDir, "network-summary.json");
const networkDirPath = path.join(logDir, "network", "network-summary.json");
const flowPath = path.join(logDir, "user-flow.md");
const apiSummaryPath = path.join(logDir, "api-summary.json");
const screenshotsDir = path.join(logDir, "screenshots");
fs.writeFileSync(consolePath, "", "utf8");
fs.writeFileSync(consoleDirPath, "", "utf8");
fs.writeFileSync(flowPath, `# Classroom Review Smoke\n\nRun ID: ${runId}\n\n`, "utf8");

const network = new Map();
const pending = new Map();
let messageId = 1;

function appendFlow(line) {
  fs.appendFileSync(flowPath, `${line}\n`, "utf8");
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.searchParams.has("access_token")) url.searchParams.set("access_token", "<redacted>");
    return `${url.origin}${url.pathname}${url.search ? url.search : ""}`;
  } catch {
    return String(raw).replace(/[?&]access_token=[^&]+/g, "access_token=<redacted>");
  }
}

async function waitForJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(300);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      this.onEvent?.(message);
    });
  }

  send(method, params = {}) {
    const id = messageId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
}

async function connect() {
  const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json/list`);
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No Chrome page target found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return new CdpClient(ws);
}

function recordNetworkStart(params) {
  if (!params.request?.url) return;
  network.set(params.requestId, {
    method: params.request.method,
    url: sanitizeUrl(params.request.url),
    status: null,
    duration_ms: null,
    request_id: params.requestId,
    error: null,
    started_at_ms: Date.now(),
  });
}

function recordNetworkResponse(params) {
  const item = network.get(params.requestId);
  if (!item) return;
  item.status = params.response.status;
  item.duration_ms = Date.now() - item.started_at_ms;
}

function recordNetworkFailure(params) {
  const item = network.get(params.requestId) || { request_id: params.requestId, url: "unknown" };
  item.error = params.errorText || "loadingFailed";
  item.duration_ms = item.started_at_ms ? Date.now() - item.started_at_ms : null;
  network.set(params.requestId, item);
}

async function navigate(client, url, waitMs = 1500) {
  await client.send("Page.navigate", { url });
  await sleep(waitMs);
}

async function screenshot(client, fileName) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  fs.writeFileSync(path.join(screenshotsDir, fileName), Buffer.from(result.data, "base64"));
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitFor(client, expression, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for expression: ${expression}; last=${JSON.stringify(last)}`);
}

async function request(pathName, { method = "GET", body, token, expectStatus } = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${apiBase}/api/v1${pathName}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const item = {
    method,
    url: `${apiBase}/api/v1${pathName}`,
    status: response.status,
    duration_ms: Date.now() - startedAt,
    request_id: `runner-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    error: response.ok ? null : text.slice(0, 220),
  };
  network.set(item.request_id, item);
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (expectStatus && response.status !== expectStatus) {
    throw new Error(`${method} ${pathName} expected ${expectStatus}, got ${response.status}: ${text}`);
  }
  if (!expectStatus && !response.ok) throw new Error(`${method} ${pathName} -> ${response.status}: ${text}`);
  return { data, status: response.status };
}

function vnParts(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((acc, item) => {
    if (item.type !== "literal") acc[item.type] = item.value;
    return acc;
  }, {});
}

function vnDate(date) {
  const p = vnParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function vnTime(date) {
  const p = vnParts(date);
  return `${p.hour}:${p.minute}:00`;
}

async function createAccount(role, suffix) {
  const password = `Smoke-${suffix}-Pass!`;
  const email = `${role}.${runId}.${suffix}@example.test`;
  await request("/auth/register", {
    method: "POST",
    body: { email, password, full_name: `${role} smoke`, phone: null },
  });
  const login = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return { email, password, token: login.data.access_token };
}

async function createTeacher(suffix) {
  const teacher = await createAccount("teacher", suffix);
  await request("/auth/become-teacher", {
    method: "POST",
    token: teacher.token,
    body: {
      title: "Smoke 中文课堂老师",
      about: "用于课堂评价 smoke 的测试档案",
      video_url: "https://example.test/intro",
      hourly_rate: 60000,
      currency: "VND",
      teacher_type: "part_time",
      specialties: ["口语", "HSK"],
    },
  });
  await request("/auth/switch-role", {
    method: "POST",
    token: teacher.token,
    body: { role: "teacher" },
  });
  const profile = await request("/teachers/me/profile", { token: teacher.token });
  teacher.profile = profile.data;
  return teacher;
}

async function addAvailability(teacher, scheduledAt) {
  const startWindow = new Date(scheduledAt.getTime() - 10 * 60 * 1000);
  const endWindow = new Date(scheduledAt.getTime() + 70 * 60 * 1000);
  await request("/availability", {
    method: "POST",
    token: teacher.token,
    body: {
      day_of_week: null,
      specific_date: vnDate(scheduledAt),
      start_time: vnTime(startWindow),
      end_time: vnTime(endWindow),
      is_recurring: false,
    },
  });
}

async function createLesson(student, teacher, minutesFromNow, topic) {
  const scheduledAt = new Date(Date.now() + minutesFromNow * 60 * 1000);
  await addAvailability(teacher, scheduledAt);
  await request("/wallet/topup", {
    method: "POST",
    token: student.token,
    body: { amount: 500000 },
  });
  const lesson = await request("/lessons", {
    method: "POST",
    token: student.token,
    body: {
      teacher_id: teacher.profile.id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: 60,
      topic,
    },
  });
  return lesson.data;
}

async function setToken(client, token) {
  const safe = JSON.stringify(token);
  await evaluate(client, `localStorage.setItem("cnvn_access_token", ${safe}); localStorage.setItem("access_token", ${safe}); true`);
}

async function clickText(client, text) {
  const safe = JSON.stringify(text);
  return await evaluate(client, `(() => {
    const nodes=[...document.querySelectorAll('button,a')];
    const el=nodes.find(n => (n.innerText||n.textContent||'').includes(${safe}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function typeChatAndSend(client, content) {
  const safe = JSON.stringify(content);
  return await evaluate(client, `(() => {
    const input=[...document.querySelectorAll('input')].find(i => i.placeholder && i.placeholder.includes('发送消息'));
    if(!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${safe});
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const btn=[...document.querySelectorAll('button')].find(b => b.title === '发送' || b.innerHTML.includes('lucide-send'));
    if(!btn || btn.disabled) return false;
    btn.click();
    return true;
  })()`);
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const blockedTeacher = await createTeacher(`blocked-${suffix}`);
const teacher = await createTeacher(`flow-${suffix}`);
const student = await createAccount("student", suffix);
const intruder = await createAccount("intruder", suffix);
const blockedLesson = await createLesson(student, blockedTeacher, 180, `Blocked ${runId}`);
const flowLesson = await createLesson(student, teacher, 5, `Flow ${runId}`);
await request(`/lessons/${blockedLesson.id}/confirm`, { method: "PATCH", token: blockedTeacher.token });
await request(`/lessons/${flowLesson.id}/confirm`, { method: "PATCH", token: teacher.token });
await request(`/lessons/${flowLesson.id}/start`, { method: "PATCH", token: teacher.token });

const client = await connect();
client.onEvent = (message) => {
  if (message.method === "Network.requestWillBeSent") recordNetworkStart(message.params);
  if (message.method === "Network.responseReceived") recordNetworkResponse(message.params);
  if (message.method === "Network.loadingFailed") recordNetworkFailure(message.params);
  if (message.method === "Runtime.consoleAPICalled") {
    const row = JSON.stringify({
      ts: new Date().toISOString(),
      type: message.params.type,
      args: message.params.args?.map((a) => a.value ?? a.description),
    });
    fs.appendFileSync(consolePath, `${row}\n`, "utf8");
    fs.appendFileSync(consoleDirPath, `${row}\n`, "utf8");
  }
  if (message.method === "Runtime.exceptionThrown") {
    const row = JSON.stringify({
      ts: new Date().toISOString(),
      type: "exception",
      text: message.params.exceptionDetails?.text,
    });
    fs.appendFileSync(consolePath, `${row}\n`, "utf8");
    fs.appendFileSync(consoleDirPath, `${row}\n`, "utf8");
  }
};
await client.send("Page.enable");
await client.send("Runtime.enable");
await client.send("Network.enable");
await client.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});

await navigate(client, webBase);
await setToken(client, student.token);
await navigate(client, `${webBase}/classroom/${blockedLesson.id}`, 1800);
await waitFor(
  client,
  `document.body.innerText.includes('暂时不能进入课堂') && document.body.innerText.includes('未到可进入时间')`,
);
const wsDuringBlocked = Array.from(network.values()).filter((item) =>
  String(item.url).includes(`/lessons/${blockedLesson.id}/ws`),
).length;
if (wsDuringBlocked !== 0) throw new Error(`blocked classroom opened websocket count=${wsDuringBlocked}`);
await screenshot(client, "us-001-classroom-blocked.png");
appendFlow(`- US-001 passed: blocked classroom rendered reason; lesson=${blockedLesson.id}; ws_requests=${wsDuringBlocked}`);

await navigate(client, `${webBase}/classroom/${flowLesson.id}`, 1800);
await waitFor(client, `document.body.innerText.includes('实时通道：已连接')`, 12000);
const chatSent = await typeChatAndSend(client, `smoke message ${runId}`);
if (!chatSent) throw new Error("chat send button was not ready");
await waitFor(client, `document.body.innerText.includes('smoke message ${runId}')`, 12000);
const messages = await request(`/lessons/${flowLesson.id}/messages?page=1&page_size=100`, {
  token: student.token,
});
if (!messages.data.items.some((m) => m.content === `smoke message ${runId}`)) {
  throw new Error("sent chat message not found in history");
}
await screenshot(client, "us-002-classroom-chat.png");
appendFlow(`- US-002 passed: classroom WS chat sent and persisted; lesson=${flowLesson.id}`);

await setToken(client, teacher.token);
await navigate(client, `${webBase}/classroom/${flowLesson.id}`, 1800);
await waitFor(client, `document.body.innerText.includes('结束课程')`, 12000);
await evaluate(client, `window.confirm = () => true; true`);
if (!(await clickText(client, "结束课程"))) throw new Error("end lesson button not found");
await waitFor(client, `location.pathname.includes('/dashboard/teacher')`, 12000);
const ended = await request(`/lessons/${flowLesson.id}`, { token: teacher.token });
if (ended.data.status !== "completed") throw new Error(`lesson expected completed, got ${ended.data.status}`);
await screenshot(client, "us-003-teacher-ended-course.png");
appendFlow(`- US-003 passed: teacher ended course via classroom UI; final_status=${ended.data.status}`);

await setToken(client, student.token);
await navigate(client, `${webBase}/dashboard/student`, 2500);
await waitFor(client, `document.body.innerText.includes('去评价')`, 12000);
await screenshot(client, "us-004-student-review-entry.png");
if (!(await clickText(client, "去评价"))) throw new Error("review entry not found");
await waitFor(client, `document.body.innerText.includes('评价课程')`, 8000);
await evaluate(client, `(() => {
  const ta=document.querySelector('textarea');
  if(!ta) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '课堂互动 smoke 评价 ${runId}');
  ta.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
})()`);
if (!(await clickText(client, "提交评价"))) throw new Error("submit review button not found");
await waitFor(client, `document.body.innerText.includes('已评价')`, 12000);
const reviewed = await request(`/lessons/${flowLesson.id}`, { token: student.token });
if (reviewed.data.status !== "reviewed") throw new Error(`lesson expected reviewed, got ${reviewed.data.status}`);
const teacherReviews = await request(`/teachers/${teacher.profile.id}/reviews?page_size=10`);
if (!teacherReviews.data.items.some((r) => String(r.lesson_id) === String(flowLesson.id))) {
  throw new Error("teacher reviews did not include submitted review");
}
await screenshot(client, "us-004-student-reviewed.png");
await navigate(client, `${webBase}/teachers/${teacher.profile.id}`, 2200);
await screenshot(client, "us-004-teacher-profile-review-visible.png");
appendFlow(`- US-004 passed: student submitted review and lesson became reviewed; teacher_reviews=${teacherReviews.data.total}`);

const intruderReview = await request("/reviews", {
  method: "POST",
  token: intruder.token,
  expectStatus: 403,
  body: { lesson_id: flowLesson.id, rating_overall: 5, content: `forbidden ${runId}` },
});
appendFlow(`- US-005 passed: third-party student review rejected; status=${intruderReview.status}`);
const duplicateReview = await request("/reviews", {
  method: "POST",
  token: student.token,
  expectStatus: 400,
  body: { lesson_id: flowLesson.id, rating_overall: 5, content: `duplicate ${runId}` },
});
appendFlow(`- US-006 passed: duplicate review rejected; status=${duplicateReview.status}`);

const apiSummary = {
  run_id: runId,
  masked_accounts: [
    teacher.email.replace(/^[^@]+/, "teacher.*"),
    student.email.replace(/^[^@]+/, "student.*"),
    intruder.email.replace(/^[^@]+/, "intruder.*"),
  ],
  blocked_lesson_id: blockedLesson.id,
  flow_lesson_id: flowLesson.id,
  final_status: reviewed.data.status,
  teacher_total_reviews: teacherReviews.data.total,
  cases: ["US-001", "US-002", "US-003", "US-004", "US-005", "US-006"],
};
fs.writeFileSync(apiSummaryPath, JSON.stringify(apiSummary, null, 2), "utf8");
const networkItems = Array.from(network.values())
  .filter((item) => item.url)
  .map(({ started_at_ms, ...item }) => item);
const networkPayload = { run_id: runId, requests: networkItems };
fs.writeFileSync(networkPath, JSON.stringify(networkPayload, null, 2), "utf8");
fs.writeFileSync(networkDirPath, JSON.stringify(networkPayload, null, 2), "utf8");
console.log(JSON.stringify({
  run_id: runId,
  status: "passed",
  cases: apiSummary.cases,
  evidence: {
    console: "browser-console.ndjson",
    network: "network-summary.json",
    screenshots: "screenshots/",
    user_flow: "user-flow.md",
  },
}));
client.ws.close();
