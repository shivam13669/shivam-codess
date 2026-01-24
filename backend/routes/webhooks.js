import express from 'express';
import { logger } from '../utils/logger.js';
import * as razorpay from '../gateways/razorpay.js';
import * as phonepe from '../gateways/phonepe.js';
import * as cashfree from '../gateways/cashfree.js';

const router = express.Router();

/**
 * POST /api/webhook/razorpay
 * Webhook endpoint for Razorpay payment notifications
 * 
 * Razorpay sends signed webhook data
 * Events: payment.authorized, payment.failed, payment.captured, refund.created, etc.
 */
router.post('/razorpay', async (req, res) => {
  try {
    const webhookData = req.body;
    const webhookSignature = req.headers['x-razorpay-signature'];

    logger.info('Received Razorpay webhook', { event: webhookData.event });

    if (!webhookSignature) {
      logger.warn('Missing Razorpay webhook signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Handle webhook
    const result = await razorpay.handleRazorpayWebhook(webhookData, webhookSignature);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    // TODO: Here you would update your database with payment status
    // Example:
    // if (result.status === 'success') {
    //   await updatePaymentInDatabase(result.paymentId, 'completed');
    //   await sendConfirmationEmail(customer);
    //   await enrollUserInCourse(userId);
    // }

    logger.info('Razorpay webhook processed', result);

    // Always return 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook received',
      data: result,
    });
  } catch (error) {
    logger.error('Error processing Razorpay webhook', { error: error.message });
    // Return 200 even on error to prevent Razorpay from retrying
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhook/phonepe
 * Webhook endpoint for PhonePe payment notifications
 * 
 * PhonePe requires Basic Auth (username + password)
 * PhonePe sends X-VERIFY header with signature
 */
router.post('/phonepe', async (req, res) => {
  try {
    const webhookData = req.body;
    const xVerifyHeader = req.headers['x-verify'];
    const authHeader = req.headers['authorization'];

    logger.info('Received PhonePe webhook');

    // Verify authentication
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      logger.warn('Missing or invalid PhonePe auth header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!xVerifyHeader) {
      logger.warn('Missing PhonePe X-VERIFY header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Handle webhook
    const result = await phonepe.handlePhonePeWebhook(webhookData, xVerifyHeader, authHeader);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    // TODO: Update database with payment status
    // Example:
    // if (result.success) {
    //   await updatePaymentInDatabase(result.transactionId, 'completed');
    //   await sendConfirmationEmail(customer);
    //   await enrollUserInCourse(userId);
    // }

    logger.info('PhonePe webhook processed', result);

    res.status(200).json({
      success: true,
      message: 'Webhook received',
      data: result,
    });
  } catch (error) {
    logger.error('Error processing PhonePe webhook', { error: error.message });
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhook/cashfree
 * Webhook endpoint for Cashfree payment notifications
 * 
 * Cashfree sends X-WEBHOOK-SIGNATURE header
 * Events: PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_USER_DROPPED, REFUND_FORWARD, etc.
 */
router.post('/cashfree', async (req, res) => {
  try {
    const webhookData = req.body;
    const signature = req.headers['x-webhook-signature'];

    logger.info('Received Cashfree webhook', { type: webhookData.type });

    if (!signature) {
      logger.warn('Missing Cashfree webhook signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Handle webhook
    const result = await cashfree.handleCashfreeWebhook(webhookData, signature);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    // TODO: Update database with payment status
    // Example:
    // if (result.success) {
    //   await updatePaymentInDatabase(result.orderId, 'completed');
    //   await sendConfirmationEmail(customer);
    //   await enrollUserInCourse(userId);
    // }

    logger.info('Cashfree webhook processed', result);

    res.status(200).json({
      success: true,
      message: 'Webhook received',
      data: result,
    });
  } catch (error) {
    logger.error('Error processing Cashfree webhook', { error: error.message });
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
