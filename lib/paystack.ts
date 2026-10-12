import { randomUUID, timingSafeEqual, createHmac } from "node:crypto";
import { connectDB } from "@/lib/db";
import { PaystackPayment, ReconstructionAccess } from "@/lib/models/CourseReconstruction";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { User } from "@/lib/models/User";

const PAYSTACK_API = "https://api.paystack.co";

type PaystackApiResponse<T> = { status: boolean; message?: string; data?: T };
type PaystackTransaction = {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  customer?: { email?: string };
};

function secretKey() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Paystack payments are not configured. Add PAYSTACK_SECRET_KEY to the server environment.");
  return secret;
}

export function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("Payments are not configured. Set APP_URL to the public address of this app.");
  const url = new URL(value);
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production")
    throw new Error("APP_URL must use HTTPS in production.");
  return url;
}

export function hasPaystackConfiguration() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.APP_URL);
}

export async function initializeReconstructionPayment(userId: string, email: string) {
  if (!email) throw new Error("A valid account email is required before purchasing access.");
  const secret = secretKey();
  const callbackUrl = new URL("/api/payments/paystack/callback", appUrl());
  await connectDB();
  const settings = await PlatformSettings.findOne({ key: "platform" }).select("reconstructionPriceNgn").lean();
  const amountNgn = settings?.reconstructionPriceNgn ?? 0;
  if (!Number.isSafeInteger(amountNgn) || amountNgn <= 0)
    throw new Error("Course reconstruction is not available for purchase yet. Ask an administrator to set the price.");
  const amountKobo = amountNgn * 100;
  if (!Number.isSafeInteger(amountKobo)) throw new Error("The configured price is too large.");

  const reference = `recon_${randomUUID().replaceAll("-", "")}`;
  await PaystackPayment.create({ userId, reference, amountKobo, currency: "NGN", status: "pending" });

  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, amount: amountKobo, currency: "NGN", reference, callback_url: callbackUrl.toString() }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    await PaystackPayment.updateOne({ reference, status: "pending" }, { $set: { status: "failed" } });
    throw new Error(error instanceof Error ? `Could not reach Paystack: ${error.message}` : "Could not reach Paystack.");
  }

  const result = await response.json().catch(() => null) as PaystackApiResponse<{ authorization_url?: string }> | null;
  const authorizationUrl = result?.data?.authorization_url;
  if (!response.ok || !result?.status || !authorizationUrl) {
    await PaystackPayment.updateOne({ reference, status: "pending" }, { $set: { status: "failed" } });
    throw new Error(result?.message || "Paystack could not start the payment. Please try again.");
  }

  const checkoutUrl = new URL(authorizationUrl);
  if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.paystack.com") {
    await PaystackPayment.updateOne({ reference, status: "pending" }, { $set: { status: "failed" } });
    throw new Error("Paystack returned an invalid checkout address.");
  }
  return { authorizationUrl: checkoutUrl.toString() };
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function verifyAndGrantReconstructionAccess(reference: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(reference)) throw new Error("Invalid payment reference.");
  const secret = secretKey();
  await connectDB();
  const payment = await PaystackPayment.findOne({ reference }).lean();
  if (!payment) throw new Error("Payment reference not found.");
  if (payment.status === "success") {
    const access = await ReconstructionAccess.findOne({ userId: payment.userId }).select("_id").lean();
    if (!access) {
      await ReconstructionAccess.create({
        userId: payment.userId,
        active: true,
        grantType: "payment",
        paymentReference: reference,
        grantedAt: payment.paidAt ?? new Date(),
      });
    }
    return { verified: true };
  }

  const response = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => null) as PaystackApiResponse<PaystackTransaction> | null;
  if (!response.ok || !result?.status || !result.data)
    throw new Error(result?.message || "Paystack could not verify this payment yet.");

  const transaction = result.data;
  const account = await User.findById(payment.userId).select("email").lean();
  if (
    transaction.status !== "success" ||
    transaction.reference !== reference ||
    transaction.amount !== payment.amountKobo ||
    transaction.currency !== payment.currency ||
    transaction.customer?.email?.trim().toLowerCase() !== account?.email?.trim().toLowerCase()
  ) {
    if (transaction.status === "failed" || transaction.status === "abandoned") {
      await PaystackPayment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed" } });
    }
    return { verified: false };
  }

  const settled = await PaystackPayment.updateOne(
    { _id: payment._id, status: "pending" },
    { $set: { status: "success", paidAt: new Date() } }
  );
  if (settled.modifiedCount > 0) {
    await ReconstructionAccess.findOneAndUpdate(
      { userId: payment.userId },
      {
        $set: {
          active: true,
          grantType: "payment",
          paymentReference: reference,
          grantedAt: new Date(),
          revokedAt: null,
        },
        $unset: { grantedBy: 1 },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }
  return { verified: true };
}
