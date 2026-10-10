import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiEmail, InfraiError } from "./infrai_email.js";
import { beginMarketplaceSignup, signupSchema } from "./marketplace_signup.js";

const apiKey = process.env.INFRAI_API_KEY;
const verificationBaseUrl = process.env.VERIFICATION_BASE_URL;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");
if (!verificationBaseUrl) throw new Error("VERIFICATION_BASE_URL is required");

const infrai = createInfraiEmail(apiKey);

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/marketplace/signups") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = signupSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await beginMarketplaceSignup(input, verificationBaseUrl, infrai);
    sendJson(response, 202, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "invalid_signup_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.detail ?? { message: error.message } });
      return;
    }
    sendJson(response, 500, { error: "signup_processing_failed" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Marketplace signup service listening on port ${process.env.PORT ?? 3000}`);
});
