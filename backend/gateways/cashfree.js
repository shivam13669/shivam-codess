import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// Cashfree API configuration
const CASHFREE_API_URL = process.env.CASHFREE_API_URL || 'https://api.cashfree.com/pg';
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_APP_SECRET = process.env.CASHFREE_APP_SECRET;

/**
 * Generate Cashfree request signature
 * @param {string} data 
 * @returns {string} SHA256 signature
 */
const generateCashfreeSignature = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Create axios instance for Cashfree API
 */
const cashfreeAPI = axios.create({
  baseURL: CASHFREE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-version': '2023-08-01',
    'x-client-id': CASHFREE_APP_ID,
  },
});

/**
 * Create Cashfree order
 * @param {object} params - { amount, currency, customer, orderId }
 * @returns {Promise<object>} Order details with payment link
 */
export const createCashfreeOrder = async (params) => {
  try {
    const { amount, currency = 'INR', customer, orderId } = params;

    const orderIdUnique = `ORD_${CASHFREE_APP_ID}_${Date.now()}`;

    logger.info('Creating Cashfree order', {
      amount,
      orderId: orderIdUnique,
      customer: customer.email,
    });

    const orderData = {
      order_id: orderIdUnique,
      order_amount: parseFloat(amount),
      order_currency: currency,
      customer_details: {
        customer_id: customer.email.replace(/[^a-zA-Z0-9]/g, ''),
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-status?orderId=${orderIdUnique}`,
        notify_url: `${process.env.BACKEND_URL || 'https://your-backend-url.com'}/api/webhook/cashfree`,
      },
      order_note: 'Payment for courses',
      order_tags: ['course', 'payment'],
    };

    // Create signature
    const signatureData = orderIdUnique + parseFloat(amount) + currency + CASHFREE_APP_SECRET;
    const signature = generateCashfreeSignature(signatureData);

    const response = await cashfreeAPI.post('/orders', orderData, {
      headers: {
        'x-idempotency-key': `${Date.now()}`,
        'x-api-key': CASHFREE_APP_SECRET,
      },
    });

    logger.info('Cashfree order created successfully', {
      orderId: response.data?.order_id,
      paymentSessionId: response.data?.payment_session_id,
    });

    return {
      orderId: response.data?.order_id,
      paymentSessionId: response.data?.payment_session_id,
      paymentLink: response.data?.payments?.find(p => p.url)?.url,
      status: response.data?.order_status,
      amount: response.data?.order_amount,
      currency: response.data?.order_currency,
    };
  } catch (error) {
    logger.error('Cashfree order creation failed', {
      error: error.message,
      response: error.response?.data,
    });
    throw {
      message: 'Failed to create Cashfree order',
      error: error.message,
    };
  }
};

/**
 * Get Cashfree order details
 * @param {string} orderId 
 * @returns {Promise<object>} Order details
 */
export const getCashfreeOrderDetails = async (orderId) => {
  try {
    logger.info('Fetching Cashfree order details', { orderId });

    const response = await cashfreeAPI.get(`/orders/${orderId}`, {
      headers: {
        'x-api-key': CASHFREE_APP_SECRET,
      },
    });

    logger.info('Cashfree order details retrieved', {
      orderId,
      status: response.data?.order_status,
    });

    return {
      orderId: response.data?.order_id,
      status: response.data?.order_status,
      amount: response.data?.order_amount,
      currency: response.data?.order_currency,
      paymentStatus: response.data?.order_payment_status,
      customerDetails: response.data?.customer_details,
      payments: response.data?.payments,
    };
  } catch (error) {
    logger.error('Failed to fetch Cashfree order details', {
      orderId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Verify Cashfree webhook signature
 * @param {object} webhookData 
 * @param {string} signature 
 * @returns {boolean} True if signature is valid
 */
const verifyCashfreeWebhookSignature = (webhookData, signature) => {
  try {
    const { data } = webhookData;
    
    if (!data) {
      logger.warn('No data in webhook');
      return false;
    }

    // Cashfree signature verification
    // signature = SHA256(orderId + orderAmount + orderCurrency + appSecret)
    const signatureData = 
      `${data.order?.order_id || ''}` +
      `${data.order?.order_amount || ''}` +
      `${data.order?.order_currency || ''}` +
      CASHFREE_APP_SECRET;

    const expectedSignature = generateCashfreeSignature(signatureData);
    const isValid = expectedSignature === signature;

    if (!isValid) {
      logger.warn('Cashfree webhook signature mismatch');
    }

    return isValid;
  } catch (error) {
    logger.error('Cashfree webhook signature verification error', {
      error: error.message,
    });
    return false;
  }
};

/**
 * Handle Cashfree webhook
 * @param {object} webhookData 
 * @param {string} signature 
 * @returns {Promise<object>} Validation result
 */
export const handleCashfreeWebhook = async (webhookData, signature) => {
  try {
    logger.info('Handling Cashfree webhook', {
      orderId: webhookData?.data?.order?.order_id,
    });

    // Verify signature
    const isValidSignature = verifyCashfreeWebhookSignature(webhookData, signature);

    if (!isValidSignature) {
      return { valid: false, message: 'Invalid signature' };
    }

    logger.info('Cashfree webhook verified');

    const { data, type } = webhookData;

    return {
      valid: true,
      type,
      orderId: data?.order?.order_id,
      status: data?.order?.order_status,
      paymentStatus: data?.order?.order_payment_status,
      amount: data?.order?.order_amount,
      payment: data?.payment,
      timestamp: data?.order?.order_creation_time,
      success: data?.order?.order_payment_status === 'PAID',
    };
  } catch (error) {
    logger.error('Cashfree webhook handling error', { error: error.message });
    throw error;
  }
};

/**
 * Get Cashfree payment details
 * @param {string} orderId 
 * @param {string} paymentId 
 * @returns {Promise<object>} Payment details
 */
export const getCashfreePaymentDetails = async (orderId, paymentId) => {
  try {
    logger.info('Fetching Cashfree payment details', { orderId, paymentId });

    const response = await cashfreeAPI.get(
      `/orders/${orderId}/payments/${paymentId}`,
      {
        headers: {
          'x-api-key': CASHFREE_APP_SECRET,
        },
      }
    );

    return {
      paymentId: response.data?.cf_payment_id,
      status: response.data?.payment_status,
      method: response.data?.payment_method,
      amount: response.data?.payment_amount,
      timestamp: response.data?.payment_time,
    };
  } catch (error) {
    logger.error('Failed to fetch Cashfree payment details', {
      orderId,
      paymentId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Refund Cashfree payment
 * @param {object} params - { orderId, paymentId, amount }
 * @returns {Promise<object>} Refund response
 */
export const refundCashfreePayment = async (params) => {
  try {
    const { orderId, paymentId, amount } = params;

    logger.info('Initiating Cashfree refund', { orderId, paymentId, amount });

    const refundData = {
      refund_amount: parseFloat(amount),
      refund_note: 'Course refund',
    };

    const response = await cashfreeAPI.post(
      `/orders/${orderId}/payments/${paymentId}/refunds`,
      refundData,
      {
        headers: {
          'x-api-key': CASHFREE_APP_SECRET,
          'x-idempotency-key': `${Date.now()}`,
        },
      }
    );

    logger.info('Cashfree refund initiated', {
      refundId: response.data?.refund_id,
      status: response.data?.refund_status,
    });

    return {
      refundId: response.data?.refund_id,
      status: response.data?.refund_status,
      amount: response.data?.refund_amount,
      orderId,
      paymentId,
    };
  } catch (error) {
    logger.error('Cashfree refund failed', {
      orderId,
      paymentId,
      error: error.message,
    });
    throw error;
  }
};

export default {
  createCashfreeOrder,
  getCashfreeOrderDetails,
  handleCashfreeWebhook,
  getCashfreePaymentDetails,
  refundCashfreePayment,
};
