// A stand-in for Resend's POST /emails, for E2E tests only.
//
// The app is pointed at it with RESEND_API_URL=http://127.0.0.1:3011 (the app
// only accepts the real API or a localhost URL there). It never sends mail.
//
//   POST /emails     recipient containing "fail"  → 503
//                    recipient containing "busy"  → 429
//                    anything else                → 200 { id }
//   GET  /__sent     every request received, newest last (for assertions)
//   GET  /           health check for Playwright's webServer
import { createServer } from "node:http";

const port = Number(process.env.MOCK_RESEND_PORT ?? 3011);
const sent = [];

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/__sent") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(sent));
  }
  if (req.method === "POST" && req.url === "/emails") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    const to = String(body.to?.[0] ?? "");
    sent.push({
      to,
      from: body.from,
      subject: body.subject,
      html: body.html,
      text: body.text,
      idempotencyKey: req.headers["idempotency-key"] ?? null,
      authorization: req.headers.authorization ? "present" : "missing",
    });
    if (to.includes("fail")) {
      res.writeHead(503, { "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "mock provider outage: internal details" }));
    }
    if (to.includes("busy")) {
      res.writeHead(429, { "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "rate limited" }));
    }
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id: `mock_${sent.length}` }));
  }
  res.writeHead(req.url === "/" ? 200 : 404);
  res.end("ok");
}).listen(port, "127.0.0.1");
