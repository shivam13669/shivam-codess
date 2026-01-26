import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * PhonePe OAuth Client API Implementation
 * Uses Client Credentials grant type with form-body authentication
 */

// Configuration - OAuth Credentials Only
const PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID;
const PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;
const PHONEPE_CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || '1';

// OAuth Token Cache
let tokenCache = {
  accessToken: null,
  expiresAt: null,
};

/**
 * Get valid OAuth access token
 * Uses identity-manager endpoint with form-body (not Basic Auth)
 * Caches token in memory and refreshes only when expired
 * @returns {Promise<string>} Valid access token
 */
const getAccessToken = async () => {
  try {
    // Check if cached token is still valid
    if (tokenCache.accessToken && tokenCache.expiresAt > Date.now()) {
      logger.debug('Using cached PhonePe access token');
      return tokenCache.accessToken;
    }

    logger.info('Generating new PhonePe OAuth access token');

    // Validate credentials exist
    if (!PHONEPE_CLIENT_ID || !PHONEPE_CLIENT_SECRET) {
      const error = 'PhonePe credentials not configured. Set PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET in .env';
      logger.error('PhonePe credentials check', {
        has_client_id: !!PHONEPE_CLIENT_ID,
        has_client_secret: !!PHONEPE_CLIENT_SECRET,
        error: error
      });
      throw new Error(error);
    }

    logger.info('PhonePe credentials validated', {
      has_client_id: !!PHONEPE_CLIENT_ID,
      has_client_secret: !!PHONEPE_CLIENT_SECRET
    });

    // Request new token using form-body (not Basic Auth)
    const response = await axios.post(
      'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
      new URLSearchParams({
        client_id: PHONEPE_CLIENT_ID,
        client_secret: PHONEPE_CLIENT_SECRET,
        client_version: PHONEPE_CLIENT_VERSION,
        grant_type: 'client_credentials',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error('No access token in response');
    }

    // Cache token with expiry (subtract 60 seconds for safety margin)
    const expiryTime = (expires_in - 60) * 1000;
    tokenCache = {
      accessToken: access_token,
      expiresAt: Date.now() + expiryTime,
    };

    logger.info('PhonePe OAuth token generated successfully', {
      expiresIn: expires_in,
    });

    return access_token;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    };
    logger.error('Failed to generate PhonePe OAuth token', errorDetails);
    throw new Error(`PhonePe Auth Error: ${error.response?.data?.error || error.message} (Status: ${error.response?.status || 'Unknown'})`);
  }
};

/**
 * Create PhonePe order using OAuth Client API
 * Minimal payload as per PhonePe OAuth spec
 * @param {object} params - { amount, customer, orderId }
 * @returns {Promise<object>} PhonePe response with redirect URL
 */
export const createPhonePeOrder = async (params) => {
  try {
    const { amount, orderId } = params;

    logger.info('Creating PhonePe order', {
      amount,
      orderId,
    });

    // Get valid access token
    const accessToken = await getAccessToken();

    // Amount in paise
    const amountInPaise = Math.round(amount * 100);

    // Minimal payload as per PhonePe OAuth specification
    const redirectUrl = `${process.env.FRONTEND_URL}/payment-success`;
    const payload = {
      merchantOrderId: orderId,
      amount: amountInPaise,
      currency: 'INR',
      redirectUrl: redirectUrl,
    };

    logger.info('PhonePe API request details', {
      endpoint: 'https://api.phonepe.com/apis/hermes/pg/v1/pay',
      method: 'POST',
      payload: payload,
      redirectUrl: redirectUrl,
      clientVersion: PHONEPE_CLIENT_VERSION
    });

    // Make API request with Bearer token
    const response = await axios.post(
      'https://api.phonepe.com/apis/hermes/pg/v1/pay',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-Version': PHONEPE_CLIENT_VERSION,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('PhonePe order created successfully', {
      orderId,
      success: response.data?.success,
    });

    // Return PhonePe response directly
    return response.data;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
      config: {
        url: error.config?.url,
        method: error.config?.method,
      }
    };
    logger.error('PhonePe order creation failed', JSON.stringify(errorDetails, null, 2));
    throw new Error(`PhonePe API Error: ${error.message || JSON.stringify(error.response?.data)} (Status: ${error.response?.status || 'Unknown'})`);
  }
};

/**
 * Check PhonePe transaction status using OAuth
 * Simplified to accept only orderId
 * @param {string} orderId - Merchant's order ID
 * @returns {Promise<object>} PhonePe transaction status
 */
export const checkPhonePeTransactionStatus = async (orderId) => {
  try {
    logger.info('Checking PhonePe transaction status', { orderId });

    // Get valid access token
    const accessToken = await getAccessToken();

    // Make API request with Bearer token
    const response = await axios.get(
      `https://api.phonepe.com/apis/hermes/pg/v1/status/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-Version': PHONEPE_CLIENT_VERSION,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('PhonePe transaction status retrieved', {
      orderId,
      success: response.data?.success,
    });

    // Return PhonePe response directly
    return response.data;
  } catch (error) {
    const errorDetails = {
      orderId,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
    };
    logger.error('PhonePe transaction status check failed', JSON.stringify(errorDetails, null, 2));
    throw {
      message: 'Failed to check PhonePe transaction status',
      error: error.message,
      details: errorDetails,
    };
  }
};

/**
 * Refund PhonePe payment using OAuth
 * @param {object} params - { transactionId, amount }
 * @returns {Promise<object>} Refund response
 */
export const refundPhonePePayment = async (params) => {
  try {
    const { transactionId, amount } = params;

    logger.info('Initiating PhonePe refund', { transactionId, amount });

    // Get valid access token
    const accessToken = await getAccessToken();

    // Amount in paise
    const amountInPaise = Math.round(amount * 100);

    // Create unique refund ID
    const refundId = `REFUND_${Date.now()}`;

    // Prepare refund request
    const payload = {
      transactionId: transactionId,
      amount: amountInPaise,
      refundId: refundId,
    };

    // Make API request with Bearer token
    const response = await axios.post(
      'https://api.phonepe.com/apis/hermes/pg/v1/refund',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-Version': PHONEPE_CLIENT_VERSION,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('PhonePe refund initiated', {
      transactionId,
      refundId,
      success: response.data?.success,
    });

    // Return PhonePe response directly
    return response.data;
  } catch (error) {
    logger.error('PhonePe refund failed', {
      error: error.message,
      response: error.response?.data,
    });
    throw {
      message: 'Failed to refund PhonePe payment',
      error: error.message,
    };
  }
};

/**
 * Handle PhonePe webhook
 * PhonePe OAuth webhooks send payment status events
 * No authorization validation needed - just process the payload
 * @param {object} webhookData - Webhook payload from PhonePe
 * @returns {Promise<object>} Webhook processing result
 */
export const handlePhonePeWebhook = async (webhookData) => {
  try {
    logger.info('Processing PhonePe webhook', {
      orderId: webhookData?.data?.merchantOrderId,
    });

    const { data, success } = webhookData || {};

    if (!webhookData || !data) {
      logger.warn('PhonePe webhook missing data field');
      return { processed: false, message: 'Invalid webhook format' };
    }

    logger.info('PhonePe webhook processed', {
      orderId: data?.merchantOrderId,
      status: data?.state,
      success,
    });

    // Return webhook data for processing by application
    return {
      processed: true,
      orderId: data?.merchantOrderId,
      status: data?.state,
      amount: data?.amount,
      success: success,
    };
  } catch (error) {
    logger.error('PhonePe webhook processing error', { error: error.message });
    throw error;
  }
};

/**
 * Clear token cache (useful for testing or manual reset)
 */
export const clearTokenCache = () => {
  tokenCache = {
    accessToken: null,
    expiresAt: null,
  };
  logger.info('PhonePe token cache cleared');
};

export default {
  createPhonePeOrder,
  checkPhonePeTransactionStatus,
  refundPhonePePayment,
  handlePhonePeWebhook,
  clearTokenCache,
};
