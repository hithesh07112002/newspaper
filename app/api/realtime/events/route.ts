import { subscribeEvents } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const heartbeat = setInterval(() => {
        controller.enqueue(
          encoder.encode(
            `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
          ),
        );
      }, 25000);

      const unsubscribe = subscribeEvents((event) => {
        controller.enqueue(encoder.encode(`event: ledger\ndata: ${JSON.stringify(event)}\n\n`));
      });

      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ ok: true, timestamp: new Date().toISOString() })}\n\n`,
        ),
      );

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
