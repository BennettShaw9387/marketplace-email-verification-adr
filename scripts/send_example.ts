import { createInfraiEmail } from "../src/infrai_email.js";
import { beginMarketplaceSignup, signupSchema } from "../src/marketplace_signup.js";

const apiKey = process.env.INFRAI_API_KEY;
const recipient = process.env.DEMO_EMAIL_TO;
const verificationBaseUrl = process.env.VERIFICATION_BASE_URL ?? "http://localhost:3000";
if (!apiKey) throw new Error("INFRAI_API_KEY is required");
if (!recipient) throw new Error("DEMO_EMAIL_TO is required");

const input = signupSchema.parse({
  signupId: "seller-demo-001",
  seller: {
    email: recipient,
    shopName: "Vector Harbor",
    assets: [{ assetId: "asset-ink-01", title: "Ink texture collection" }],
  },
  buyerUpdates: { enabledAfterVerification: true },
  orderHandoff: { mode: "download" },
});

const result = await beginMarketplaceSignup(input, verificationBaseUrl, createInfraiEmail(apiKey));
console.log(result);
