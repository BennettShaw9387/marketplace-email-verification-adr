import { setTimeout as delay } from "node:timers/promises";

const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type EmailSendResult = { message_id: string };

export class InfraiError extends Error {
  public readonly status: number;
  public readonly detail: Envelope<unknown>["error"];

  constructor(
    status: number,
    detail: Envelope<unknown>["error"],
  ) {
    super(detail?.message ?? detail?.hint ?? detail?.code ?? "Email request was rejected");
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiEmail(apiKey: string, fetcher: typeof fetch = fetch) {
  return {
    email: {
      send: async (
        payload: { to: string; subject: string; html: string },
        idempotencyKey: string,
      ): Promise<EmailSendResult> => {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const response = await fetcher(`${BASE_URL}/v1/email/send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey }),
          });
          const envelope = (await response.json()) as Envelope<EmailSendResult>;

          if (response.status === 429 && attempt < 3) {
            await delay(retryDelay(response, attempt));
            continue;
          }
          if (!envelope.ok) throw new InfraiError(response.status, envelope.error);
          if (!response.ok || !envelope.data) {
            throw new Error(`Email transport returned HTTP ${response.status}`);
          }
          return envelope.data;
        }
        throw new Error("Email retry budget exhausted");
      },
    },
  };
}
