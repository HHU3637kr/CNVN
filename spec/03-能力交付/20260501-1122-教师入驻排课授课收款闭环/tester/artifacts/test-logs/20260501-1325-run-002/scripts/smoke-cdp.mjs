import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const logDir = process.env.LOG_DIR;
const repoRoot = process.env.REPO_ROOT;
const runId = process.env.RUN_ID;
const cdpPort = process.env.CDP_PORT || "9222";
const apiBase = process.env.API_BASE_URL || "http://localhost:8001";
const webBase = process.env.WEB_BASE_URL || "http://127.0.0.1:5173";
const dbUrl = process.env.DATABASE_URL;

if (!logDir || !repoRoot || !runId || !dbUrl) {
  throw new Error("LOG_DIR, REPO_ROOT, RUN_ID and DATABASE_URL are required");
}

const consolePath = path.join(logDir, "browser-console.ndjson");
const networkPath = path.join(logDir, "network-summary.json");
const flowPath = path.join(logDir, "user-flow.md");
const releaseLogPath = path.join(logDir, "release-payment.log");
const screenshotsDir = path.join(logDir, "screenshots");

fs.writeFileSync(consolePath, "", "utf8");
fs.writeFileSync(flowPath, `# Teacher Supply Smoke\n\nRun ID: ${runId}\n\n`, "utf8");

const network = new Map();
const pending = new Map();
let messageId = 1;

function appendFlow(line) {
  fs.appendFileSync(flowPath, `${line}\n`, "utf8");
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
    url: params.request.url,
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
  const item = network.get(params.requestId) || { request_id: params.requestId };
  item.error = params.errorText || "loadingFailed";
  item.duration_ms = item.started_at_ms ? Date.now() - item.started_at_ms : null;
  network.set(params.requestId, item);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(1200);
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
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function runnerApi(pathName, { method = "GET", token } = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${apiBase}/api/v1${pathName}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await response.text();
  const item = {
    method,
    url: `${apiBase}/api/v1${pathName}`,
    status: response.status,
    duration_ms: Date.now() - startedAt,
    request_id: `runner-${Date.now()}`,
    error: response.ok ? null : text.slice(0, 300),
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
  if (!response.ok) {
    throw new Error(`${method} ${pathName} -> ${response.status}: ${text}`);
  }
  return data;
}

function smokeExpression() {
  return `(${async function runSmoke(input) {
    const { apiBase, runId } = input;
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const password = `Smoke-${suffix}-Pass!`;

    async function request(path, { method = "GET", body, token } = {}) {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${apiBase}/api/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!response.ok) {
        throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
      }
      return data;
    }

    function vnParts(date) {
      const parts = new Intl.DateTimeFormat("en-CA", {
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
      return parts;
    }

    function vnDate(date) {
      const p = vnParts(date);
      return `${p.year}-${p.month}-${p.day}`;
    }

    function vnTime(date) {
      const p = vnParts(date);
      return `${p.hour}:${p.minute}:00`;
    }

    const teacher = {
      email: `teacher.${runId}.${suffix}@example.test`,
      password,
      full_name: "Smoke Teacher",
      phone: null,
    };
    const student = {
      email: `student.${runId}.${suffix}@example.test`,
      password,
      full_name: "Smoke Student",
      phone: null,
    };

    await request("/auth/register", { method: "POST", body: teacher });
    const teacherLogin = await request("/auth/login", {
      method: "POST",
      body: { email: teacher.email, password },
    });
    localStorage.setItem("cnvn_access_token", teacherLogin.access_token);
    localStorage.setItem("access_token", teacherLogin.access_token);
    await request("/auth/become-teacher", {
      method: "POST",
      token: teacherLogin.access_token,
      body: {
        title: "Smoke 初始中文老师",
        about: "用于教师供给闭环 smoke 的测试档案",
        video_url: "https://example.test/smoke-intro",
        hourly_rate: 120000,
        currency: "VND",
        teacher_type: "part_time",
        specialties: ["HSK", "口语"],
      },
    });
    await request("/auth/switch-role", {
      method: "POST",
      token: teacherLogin.access_token,
      body: { role: "teacher" },
    });
    const teacherProfile = await request("/teachers/me/profile", {
      token: teacherLogin.access_token,
    });

    const updatedProfile = await request("/teachers/profile", {
      method: "PUT",
      token: teacherLogin.access_token,
      body: {
        title: "Smoke 高级中文口语老师",
        about: "已保存的 smoke 档案",
        hourly_rate: 150000,
        currency: "VND",
        teacher_type: "part_time",
        specialties: ["HSK4", "商务中文"],
      },
    });

    const scheduledAt = new Date(Date.now() + 5 * 60 * 1000);
    const startWindow = new Date(Date.now() - 10 * 60 * 1000);
    const endWindow = new Date(Date.now() + 90 * 60 * 1000);

    const availability = await request("/availability", {
      method: "POST",
      token: teacherLogin.access_token,
      body: {
        day_of_week: null,
        specific_date: vnDate(scheduledAt),
        start_time: vnTime(startWindow),
        end_time: vnTime(endWindow),
        is_recurring: false,
      },
    });
    const editedAvailability = await request(`/availability/${availability.id}`, {
      method: "PUT",
      token: teacherLogin.access_token,
      body: {
        day_of_week: Number(new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Ho_Chi_Minh",
          weekday: "short",
        }).format(scheduledAt) === "Sun" ? 0 : scheduledAt.getUTCDay()),
        specific_date: null,
        start_time: vnTime(startWindow),
        end_time: vnTime(endWindow),
        is_recurring: true,
      },
    });
    const restoredAvailability = await request(`/availability/${availability.id}`, {
      method: "PUT",
      token: teacherLogin.access_token,
      body: {
        day_of_week: null,
        specific_date: vnDate(scheduledAt),
        start_time: vnTime(startWindow),
        end_time: vnTime(endWindow),
        is_recurring: false,
      },
    });

    await request("/auth/register", { method: "POST", body: student });
    const studentLogin = await request("/auth/login", {
      method: "POST",
      body: { email: student.email, password },
    });
    await request("/wallet/topup", {
      method: "POST",
      token: studentLogin.access_token,
      body: { amount: 500000 },
    });
    const lesson = await request("/lessons", {
      method: "POST",
      token: studentLogin.access_token,
      body: {
        teacher_id: teacherProfile.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 60,
        topic: `Smoke ${runId}`,
      },
    });

    const confirmed = await request(`/lessons/${lesson.id}/confirm`, {
      method: "PATCH",
      token: teacherLogin.access_token,
    });
    const started = await request(`/lessons/${lesson.id}/start`, {
      method: "PATCH",
      token: teacherLogin.access_token,
    });
    const studentEndResponse = await fetch(`${apiBase}/api/v1/lessons/${lesson.id}/end`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentLogin.access_token}`,
      },
    });
    const studentEndBody = await studentEndResponse.text();
    if (studentEndResponse.status !== 403) {
      throw new Error(`student end expected 403, got ${studentEndResponse.status}: ${studentEndBody}`);
    }
    return {
      cases: {
        "US-001": { status: "passed", teacherRole: "teacher", teacherProfileId: teacherProfile.id },
        "US-002": { status: "passed", title: updatedProfile.title, hourlyRate: updatedProfile.hourly_rate },
        "US-003": {
          status: "passed",
          createdMode: availability.specific_date ? "date" : "weekly",
          editedMode: editedAvailability.day_of_week !== null ? "weekly" : "date",
          restoredMode: restoredAvailability.specific_date ? "date" : "weekly",
        },
        "US-004": { status: "passed", lessonId: lesson.id, state: confirmed.status },
        "US-005": {
          status: "passed",
          started: started.status,
          studentEndStatus: studentEndResponse.status,
          ended: "pending-runner-end",
        },
        "US-006": { status: "pending-release", lessonId: lesson.id },
      },
      tokens: { teacher: teacherLogin.access_token, student: studentLogin.access_token },
      lessonId: lesson.id,
      teacherEmailMasked: teacher.email.replace(/^[^@]+/, "teacher.*"),
      studentEmailMasked: student.email.replace(/^[^@]+/, "student.*"),
    };
  }})(${JSON.stringify({ apiBase, runId })})`;
}

const client = await connect();
client.onEvent = (message) => {
  if (message.method === "Network.requestWillBeSent") recordNetworkStart(message.params);
  if (message.method === "Network.responseReceived") recordNetworkResponse(message.params);
  if (message.method === "Network.loadingFailed") recordNetworkFailure(message.params);
  if (message.method === "Runtime.consoleAPICalled") {
    fs.appendFileSync(consolePath, `${JSON.stringify({ ts: new Date().toISOString(), method: message.method, type: message.params.type, args: message.params.args?.map((a) => a.value ?? a.description) })}\n`, "utf8");
  }
  if (message.method === "Runtime.exceptionThrown") {
    fs.appendFileSync(consolePath, `${JSON.stringify({ ts: new Date().toISOString(), method: message.method, exception: message.params.exceptionDetails?.text })}\n`, "utf8");
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

await navigate(client, `${webBase}/register`);
await screenshot(client, "us-001-register-entry.png");

const smoke = await evaluate(client, smokeExpression());
appendFlow(`- US-001 passed: teacher onboarding completed; teacher_profile=${smoke.cases["US-001"].teacherProfileId}`);
appendFlow(`- US-002 passed: profile saved; title=${smoke.cases["US-002"].title}; hourly_rate=${smoke.cases["US-002"].hourlyRate}`);
appendFlow(`- US-003 passed: availability modes ${smoke.cases["US-003"].createdMode} -> ${smoke.cases["US-003"].editedMode} -> ${smoke.cases["US-003"].restoredMode}`);
appendFlow(`- US-004 passed: lesson confirmed; lesson=${smoke.lessonId}; state=${smoke.cases["US-004"].state}`);
const ended = await runnerApi(`/lessons/${smoke.lessonId}/end`, {
  method: "PATCH",
  token: smoke.tokens.teacher,
});
appendFlow(`- US-005 passed: teacher start/end and student end forbidden; student_end_status=${smoke.cases["US-005"].studentEndStatus}; final_state=${ended.status}`);

await navigate(client, `${webBase}/dashboard/teacher`);
await screenshot(client, "us-001-us-002-us-003-us-004-teacher-dashboard.png");

await navigate(client, `${webBase}/classroom/${smoke.lessonId}`);
await screenshot(client, "us-005-classroom-teacher-view.png");

const releaseOutput = execFileSync("python", [path.join(logDir, "scripts", "release_payment.py"), smoke.lessonId], {
  cwd: path.join(repoRoot, "backend"),
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: dbUrl, APP_DEBUG: "false" },
});
fs.writeFileSync(releaseLogPath, releaseOutput, "utf8");

await navigate(client, `${webBase}/payouts`);
await sleep(1000);
await screenshot(client, "us-006-payouts-explanation.png");

appendFlow("- US-006 passed: payout release completed and payouts page captured");
appendFlow("");
appendFlow(`Masked accounts: ${smoke.teacherEmailMasked}, ${smoke.studentEmailMasked}`);

const networkItems = Array.from(network.values())
  .filter((item) => item.url)
  .map(({ started_at_ms, ...item }) => ({
    ...item,
    url: item.url.replace(/[?&]access_token=[^&]+/g, "access_token=<redacted>"),
  }));
fs.writeFileSync(networkPath, JSON.stringify({ run_id: runId, requests: networkItems }, null, 2), "utf8");
console.log(JSON.stringify({
  run_id: runId,
  status: "passed",
  cases: ["US-001", "US-002", "US-003", "US-004", "US-005", "US-006"],
  evidence: {
    console: "browser-console.ndjson",
    network: "network-summary.json",
    backend: "backend.log",
    user_flow: "user-flow.md",
    screenshots: "screenshots/",
  },
}));

client.ws.close();
