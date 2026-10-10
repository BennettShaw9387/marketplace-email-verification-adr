import assert from "node:assert/strict";
import test from "node:test";
import { beginMarketplaceSignup, signupSchema, type EmailPort } from "../src/marketplace_signup.js";

test("holds buyer updates and order handoff until seller email verification", async () => {
  const calls: Array<{ payload: { to: string; subject: string; html: string }; key: string }> = [];
  const email: EmailPort = {
    email: {
      send: async (payload, key) => {
        calls.push({ payload, key });
        return { message_id: "msg_test_42" };
      },
    },
  };
  const input = signupSchema.parse({
    signupId: "signup-test-42",
    seller: {
      email: "seller@example.com",
      shopName: "Paper Circuit",
      assets: [{ assetId: "asset-1", title: "Circuit poster" }],
    },
    buyerUpdates: { enabledAfterVerification: true },
    orderHandoff: { mode: "download" },
  });

  const result = await beginMarketplaceSignup(input, "https://market.example", email);

  assert.equal(result.state, "pending_email_verification");
  assert.equal(result.buyerUpdates, "held_until_email_verified");
  assert.equal(result.orderHandoff, "held_until_email_verified");
  assert.equal(result.messageId, "msg_test_42");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.payload.to, "seller@example.com");
  assert.match(calls[0]?.payload.html ?? "", /verify-email\?token=/);
  assert.match(calls[0]?.key ?? "", /^marketplace-signup:/);
});

test("rejects a signup that omits the seller asset model", () => {
  assert.equal(signupSchema.safeParse({
    signupId: "signup-test-43",
    seller: { email: "seller@example.com", shopName: "Paper Circuit" },
    buyerUpdates: { enabledAfterVerification: true },
    orderHandoff: { mode: "download" },
  }).success, false);
});
