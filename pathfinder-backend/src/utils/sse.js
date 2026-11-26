// Server-Sent Events helpers for the long AI calls (a TCAS plan takes ~45s with real Gemini).
// A client opts in with "Accept: text/event-stream"; everyone else still gets plain JSON.

export const wantsStream = (req) => /text\/event-stream/i.test(req.get('accept') ?? '');

export function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  const open = () => !res.writableEnded && !res.destroyed;
  return {
    send(event, data) {
      if (open()) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      if (open()) res.end();
    },
  };
}
