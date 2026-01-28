import axios from "axios";
import { logger } from "../utils/logger.js";

const CASHFREE_API_URL =
  process.env.CASHFREE_API_URL || "https://api.cashfree.com/pg";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_APP_SECRET = process.env.CASHFREE_APP_SECRET;

/**
 * Axios instance
 */
const cashfreeAPI = axios.create({
  baseURL: CASHFREE_API_URL,
  headers: {
    "Content-Type": "application/json",
    "x-api-version": "2025-01-01",
    "x-client-id": CASHFREE_APP_ID,
    "x-client-secret": CASHFREE_APP_SECRET,
  },
});

/**
 * Create Order
 */
export const createCashfreeOrder = async (params) => {
  try {
    const { amount, currency = "INR", customer } = params;

    const orderId = `ORD_${Date.now()}`;

    const orderData = {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: currency,
      customer_details: {
        customer_id: customer.email.replace(/[^a-zA-Z0-9]/g, ""),
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-status?orderId=${orderId}`,
        notify_url: `${process.env.BACKEND_URL}/api/webhook/cashfree`,
      },
    };

    const response = await cashfreeAPI.post("/orders", orderData, {
      headers: {
        "x-idempotency-key": `${Date.now()}`,
      },
    });

    return {
      orderId: response.data.order_id,
      paymentSessionId: response.data.payment_session_id,
      status: response.data.order_status,
    };
  } catch (err) {
    logger.error("Cashfree create order failed", err.response?.data || err);
    throw err;
  }
};

/**
 * Get Order
 */
export const getCashfreeOrderDetails = async (orderId) => {
  const res = await cashfreeAPI.get(`/orders/${orderId}`);
  return res.data;
};

/**
 * Webhook Handler
 */
export const handleCashfreeWebhook = async (payload) => {
  return {
    orderId: payload?.data?.order?.order_id,
    status: payload?.data?.order?.order_status,
    paymentStatus: payload?.data?.order?.order_payment_status,
    amount: payload?.data?.order?.order_amount,
    success: payload?.data?.order?.order_payment_status === "PAID",
  };
};

/**
 * Payment Details
 */
export const getCashfreePaymentDetails = async (orderId, paymentId) => {
  const res = await cashfreeAPI.get(`/orders/${orderId}/payments/${paymentId}`);
  return res.data;
};

/**
 * Refund
 */
export const refundCashfreePayment = async ({ orderId, paymentId, amount }) => {
  const res = await cashfreeAPI.post(
    `/orders/${orderId}/payments/${paymentId}/refunds`,
    {
      refund_amount: Number(amount),
      refund_note: "Refund",
    },
    {
      headers: {
        "x-idempotency-key": `${Date.now()}`,
      },
    }
  );

  return res.data;
};

export default {
  createCashfreeOrder,
  getCashfreeOrderDetails,
  handleCashfreeWebhook,
  getCashfreePaymentDetails,
  refundCashfreePayment,
};
