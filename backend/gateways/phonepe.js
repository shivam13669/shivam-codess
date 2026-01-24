import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// PhonePe API endpoints
const PHONEPE_API_URL = process.env.PHONEPE_API_URL || 'https://api.phonepe.com/apis/hermes';
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';

/**
 * Generate X-VERIFY header for PhonePe requests
 * @param {string} requestBody 
 * @returns {string} X-VERIFY header value
 */
const generatePhonePeSignature = (requestBody) => {
  const payload = requestBody + PHONEPE_SALT_KEY;
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return `${hash}###${PHONEPE_SALT_INDEX}`;
};

/**
 * Verify PhonePe webhook signature
 * @param {string} requestBody 
 * @param {string} xVerifyHeader 
 * @returns {boolean} True if signature is valid
 */
const verifyPhonePeSignature = (requestBody, xVerifyHeader) => {
  const signature = generatePhonePeSignature(requestBody);
  return signature === xVerifyHeader;
};

/**
 * Create PhonePe order
 * @param {object} params - { amount, currency, customer, orderId }
 * @returns {Promise<object>} Payment URL and transaction ID
 */
export const createPhonePeOrder = async (params) => {
  try {
    const { amount, currency = 'INR', customer, orderId } = params;
    
    const transactionId = `TXN_${PHONEPE_MERCHANT_ID}_${Date.now()}`;

    logger.info('Creating PhonePe order', {
      amount,
      transactionId,
      customer: customer.email,
    });

    // PhonePe expects amount in paise
    const amountInPaise = Math.round(amount * 100);

    const payloadData = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: transactionId,
      merchantUserId: customer.email.replace(/[^a-zA-Z0-9]/g, ''),
      amount: amountInPaise,
      redirectUrl: `${process.env.FRONTEND_URL}/payment-status?transactionId=${transactionId}`,
      redirectMode: 'GET',
      callbackUrl: `${process.env.BACKEND_URL || 'https://your-backend-url.com'}/api/webhook/phonepe`,
      mobileNumber: customer.phone,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    // Base64 encode payload
    const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64');

    // Generate signature
    const xVerify = generatePhonePeSignature(payload);

    // Make API request
    const response = await axios.post(
      `${PHONEPE_API_URL}/pg/v1/pay`,
      { request: payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
        },
      }
    );

    logger.info('PhonePe order created successfully', {
      transactionId,
      redirectUrl: response.data?.data?.instrumentResponse?.redirectUrl,
    });

    return {
      transactionId,
      merchantId: PHONEPE_MERCHANT_ID,
      redirectUrl: response.data?.data?.instrumentResponse?.redirectUrl,
      paymentUrl: response.data?.data?.instrumentResponse?.redirectUrl,
      status: response.data?.success ? 'INITIATED' : 'FAILED',
    };
  } catch (error) {
    logger.error('PhonePe order creation failed', {
      error: error.message,
      response: error.response?.data,
    });
    throw {
      message: 'Failed to create PhonePe order',
      error: error.message,
    };
  }
};

/**
 * Check PhonePe transaction status
 * @param {string} transactionId 
 * @returns {Promise<object>} Transaction details
 */
export const checkPhonePeTransactionStatus = async (transactionId) => {
  try {
    logger.info('Checking PhonePe transaction status', { transactionId });

    const payloadData = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: transactionId,
    };

    const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64');
    const xVerify = generatePhonePeSignature(payload);

    const response = await axios.get(
      `${PHONEPE_API_URL}/pg/v1/status/${PHONEPE_MERCHANT_ID}/${transactionId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
        },
      }
    );

    logger.info('PhonePe transaction status retrieved', {
      transactionId,
      status: response.data?.data?.responseCode,
    });

    return {
      transactionId,
      status: response.data?.data?.state,
      responseCode: response.data?.data?.responseCode,
      amount: response.data?.data?.amount,
      success: response.data?.success,
    };
  } catch (error) {
    logger.error('PhonePe transaction status check failed', {
      transactionId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Handle PhonePe webhook with Basic Auth
 * @param {object} webhookData 
 * @param {string} xVerifyHeader 
 * @param {string} authHeader - Basic Auth header
 * @returns {Promise<object>} Validation result
 */
export const handlePhonePeWebhook = async (webhookData, xVerifyHeader, authHeader) => {
  try {
    // Verify Basic Auth
    const expectedAuth = Buffer.from(
      `${process.env.PHONEPE_WEBHOOK_USER}:${process.env.PHONEPE_WEBHOOK_PASS}`
    ).toString('base64');

    const providedAuth = authHeader?.replace('Basic ', '') || '';

    if (providedAuth !== expectedAuth) {
      logger.warn('PhonePe webhook authentication failed');
      return { valid: false, message: 'Invalid authentication' };
    }

    logger.info('PhonePe webhook authenticated');

    // Verify signature
    const webhookBody = JSON.stringify(webhookData);
    const isValidSignature = verifyPhonePeSignature(webhookBody, xVerifyHeader);

    if (!isValidSignature) {
      logger.warn('PhonePe webhook signature mismatch');
      return { valid: false, message: 'Invalid signature' };
    }

    logger.info('PhonePe webhook verified');

    const { data } = webhookData;

    // Parse response data (it's base64 encoded)
    let responseData = {};
    try {
      responseData = JSON.parse(
        Buffer.from(data.response, 'base64').toString('utf-8')
      );
    } catch (e) {
      responseData = data.response;
    }

    return {
      valid: true,
      transactionId: responseData.merchantTransactionId,
      status: responseData.state,
      responseCode: responseData.responseCode,
      amount: responseData.amount,
      timestamp: responseData.transactionDate,
      success: responseData.state === 'COMPLETED',
    };
  } catch (error) {
    logger.error('PhonePe webhook handling error', { error: error.message });
    throw error;
  }
};

/**
 * Refund PhonePe payment
 * @param {object} params - { transactionId, amount }
 * @returns {Promise<object>} Refund response
 */
export const refundPhonePePayment = async (params) => {
  try {
    const { transactionId, amount } = params;

    logger.info('Initiating PhonePe refund', { transactionId, amount });

    const payloadData = {
      merchantId: PHONEPE_MERCHANT_ID,
      originalTransactionId: transactionId,
      amount: Math.round(amount * 100),
      refundId: `REFUND_${Date.now()}`,
    };

    const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64');
    const xVerify = generatePhonePeSignature(payload);

    const response = await axios.post(
      `${PHONEPE_API_URL}/pg/v1/refund`,
      { request: payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
        },
      }
    );

    logger.info('PhonePe refund initiated', {
      transactionId,
      refundId: response.data?.data?.refundId,
    });

    return {
      refundId: response.data?.data?.refundId,
      status: response.data?.success ? 'INITIATED' : 'FAILED',
      originalTransactionId: transactionId,
    };
  } catch (error) {
    logger.error('PhonePe refund failed', {
      error: error.message,
    });
    throw error;
  }
};

export default {
  createPhonePeOrder,
  checkPhonePeTransactionStatus,
  handlePhonePeWebhook,
  refundPhonePePayment,
};
