import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const signupSchema = z.object({
  signupId: z.string().min(8).max(80),
  seller: z.object({
    email: z.string().email(),
    shopName: z.string().min(2).max(80),
    assets: z.array(z.object({
      assetId: z.string().min(1).max(80),
      title: z.string().min(1).max(120),
    }).strict()).min(1).max(20),
  }).strict(),
  buyerUpdates: z.object({ enabledAfterVerification: z.literal(true) }).strict(),
  orderHandoff: z.object({ mode: z.enum(["download", "seller_fulfillment"]) }).strict(),
}).strict();

export type MarketplaceSignup = z.infer<typeof signupSchema>;
export type PendingSignup = {
  signupId: string;
  sellerEmail: string;
  assetCount: number;
  buyerUpdates: "held_until_email_verified";
  orderHandoff: "held_until_email_verified";
  verificationToken: string;
};

export type EmailPort = {
  email: {
    send(payload: { to: string; subject: string; html: string }, idempotencyKey: string):
      Promise<{ message_id: string }>;
  };
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function preparePendingSignup(input: MarketplaceSignup): PendingSignup {
  return {
    signupId: input.signupId,
    sellerEmail: input.seller.email,
    assetCount: input.seller.assets.length,
    buyerUpdates: "held_until_email_verified",
    orderHandoff: "held_until_email_verified",
    verificationToken: randomBytes(32).toString("base64url"),
  };
}

export async function beginMarketplaceSignup(
  input: MarketplaceSignup,
  verificationBaseUrl: string,
  infrai: EmailPort,
) {
  const pending = preparePendingSignup(input);
  const link = new URL("/verify-email", verificationBaseUrl);
  link.searchParams.set("token", pending.verificationToken);
  const result = await infrai.email.send({
    to: input.seller.email,
    subject: `Verify your email for ${input.seller.shopName}`,
    html: `<h1>Verify your seller email</h1><p>${escapeHtml(input.seller.shopName)} has ${pending.assetCount} asset${pending.assetCount === 1 ? "" : "s"} ready for review.</p><p><a href="${escapeHtml(link.toString())}">Verify email</a> to enable buyer updates and ${escapeHtml(input.orderHandoff.mode.replace("_", " "))} order handoff.</p>`,
  }, `marketplace-signup:${createHash("sha256").update(input.signupId).digest("hex")}`);

  return {
    signupId: pending.signupId,
    state: "pending_email_verification" as const,
    buyerUpdates: pending.buyerUpdates,
    orderHandoff: pending.orderHandoff,
    messageId: result.message_id,
  };
}
