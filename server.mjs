import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { extname, resolve } from "node:path";

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const dataFile = resolve("participants.local.json");
const indexFile = resolve("index.html");
const clients = new Set();

/** @type {{ participants: Array<{ id: string; name: string; joinedAt: number; source: string }> }} */
let state = { participants: [] };

await loadState();

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/state") {
      sendJson(response, withServerHints(request));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/events") {
      openEventStream(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/join") {
      const body = await readJson(request);
      const name = cleanName(body.name);
      if (!name) {
        sendJson(response, { ok: false, error: "Name is required." }, 400);
        return;
      }

      const participant = addParticipant(name, body.source === "manual" ? "manual" : "qr");
      await persistState();
      broadcast();
      sendJson(response, { ok: true, participant, state: withServerHints(request) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/remove") {
      const body = await readJson(request);
      state.participants = state.participants.filter((participant) => participant.id !== body.id);
      await persistState();
      broadcast();
      sendJson(response, { ok: true, state: withServerHints(request) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/clear") {
      state.participants = [];
      await persistState();
      broadcast();
      sendJson(response, { ok: true, state: withServerHints(request) });
      return;
    }

    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }

    response.writeHead(405);
    response.end("Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(response, { ok: false, error: "Server error." }, 500);
  }
});

server.listen(port, host, () => {
  const urls = getLanUrls(port);
  console.log(`Wheel2 local server running at http://localhost:${port}`);
  for (const url of urls) {
    console.log(`LAN URL: ${url}`);
  }
});

async function loadState() {
  if (!existsSync(dataFile)) return;

  try {
    const saved = JSON.parse(await readFile(dataFile, "utf8"));
    if (Array.isArray(saved.participants)) {
      state.participants = saved.participants;
    }
  } catch (error) {
    console.warn("Could not read participants.local.json. Starting with an empty wheel.");
  }
}

async function persistState() {
  await writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
}

function withServerHints(request) {
  const hostHeader = request.headers.host || `localhost:${port}`;
  const protocol = request.socket.encrypted ? "https" : "http";
  const origin = `${protocol}://${hostHeader}`;

  return {
    ok: true,
    participants: state.participants,
    serverTime: Date.now(),
    joinPath: "/?join=1",
    joinUrl: `${origin}/?join=1`,
    lanJoinUrls: getLanUrls(port).map((url) => `${url}/?join=1`)
  };
}

function addParticipant(name, source) {
  const normalized = normalizeName(name);
  const existing = state.participants.find((participant) => normalizeName(participant.name) === normalized);
  if (existing) return existing;

  const participant = {
    id: crypto.randomUUID(),
    name,
    joinedAt: Date.now(),
    source
  };
  state.participants.push(participant);
  return participant;
}

function cleanName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function normalizeName(value) {
  return cleanName(value).toLocaleLowerCase("en-US");
}

function readJson(request) {
  return new Promise((resolveRequest, rejectRequest) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000) {
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolveRequest(body ? JSON.parse(body) : {});
      } catch (error) {
        rejectRequest(error);
      }
    });
    request.on("error", rejectRequest);
  });
}

async function serveStatic(pathname, response) {
  const safePath = pathname === "/" || pathname === "/join" ? "/index.html" : pathname;
  const absolutePath = resolve(`.${safePath}`);

  if (!absolutePath.startsWith(process.cwd())) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (safePath !== "/index.html") {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const content = await readFile(indexFile);
  response.writeHead(200, {
    "Content-Type": mimeType(extname(safePath)),
    "Cache-Control": "no-store"
  });
  response.end(content);
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload));
}

function openEventStream(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  response.write(`data: ${JSON.stringify(withServerHints(request))}\n\n`);
  clients.add(response);
  request.on("close", () => clients.delete(response));
}

function broadcast() {
  const payload = JSON.stringify({ ok: true, participants: state.participants, serverTime: Date.now() });
  for (const client of clients) {
    client.write(`data: ${payload}\n\n`);
  }
}

function getLanUrls(serverPort) {
  const urls = [];
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const item of interfaces || []) {
      if (item.family === "IPv4" && !item.internal) {
        urls.push(`http://${item.address}:${serverPort}`);
      }
    }
  }
  return urls;
}

function mimeType(extension) {
  if (extension === ".html") return "text/html; charset=utf-8";
  return "text/plain; charset=utf-8";
}
