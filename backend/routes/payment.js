import express from 'express';
import { logger } from '../utils/logger.js';
import { validators } from '../utils/validators.js';
import * as razorpay from '../gateways/razorpay.js';
import * as phonepe from '../gateways/phonepe.js';
import * as cashfree from '../gateways/cashfree.js';

const router = express.Router();

/**
 * POST /api/payment/create-order
 * Create a payment order with the specified gateway
 * 
 * Request body:
 * {
 *   "amount": 499,
 *   "gateway": "razorpay" | "phonepe" | "cashfree",
 *   "customer": {
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "phone": "9876543210"
 *   },
 *   "description": "Full Stack Development Course"
 * }
 * 
 * Response: Gateway-specific order data
 */
router.post('/create-order', async (req, res) => {
  try {
    const { amount, gateway, customer, description } = req.body;

    // Validate input
    const amountValidation = validators.validateAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({ error: amountValidation.error });
    }

    const gatewayValidation = validators.validateGateway(gateway);
    if (!gatewayValidation.valid) {
      return res.status(400).json({ error: gatewayValidation.error });
    }

    const customerValidation = validators.validateCustomer(customer);
    if (!customerValidation.valid) {
      return res.status(400).json({ error: customerValidation.error });
    }

    logger.info('Creating payment order', { gateway, amount, customer: customer.email });

    let order;

    switch (gateway.toLowerCase()) {
      case 'razorpay':
        order = await razorpay.createRazorpayOrder({
          amount,
          currency: 'INR',
          customer,
          description,
        });
        break;

      case 'phonepe':
        order = await phonepe.createPhonePeOrder({
          amount,
          currency: 'INR',
          customer,
          orderId: `order_${Date.now()}`,
        });
        break;

      case 'cashfree':
        order = await cashfree.createCashfreeOrder({
          amount,
          currency: 'INR',
          customer,
          orderId: `order_${Date.now()}`,
        });
        break;

      default:
        return res.status(400).json({ error: 'Unsupported gateway' });
    }

    logger.info('Order created successfully', { gateway, orderId: order.orderId || order.transactionId });

    res.status(200).json({
      success: true,
      gateway,
      order,
    });
  } catch (error) {
    logger.error('Error creating order', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order',
      ...(process.env.NODE_ENV === 'development' && { details: error }),
    });
  }
});

/**
 * POST /api/payment/verify-payment
 * Verify payment authenticity using gateway signature
 * 
 * Request body (varies by gateway):
 * 
 * Razorpay:
 * {
 *   "gateway": "razorpay",
 *   "orderId": "order_xyz",
 *   "paymentId": "pay_xyz",
 *   "signature": "signature_xyz"
 * }
 * 
 * PhonePe:
 * {
 *   "gateway": "phonepe",
 *   "transactionId": "TXN_xyz",
 *   "amount": 500
 * }
 * 
 * Cashfree:
 * {
 *   "gateway": "cashfree",
 *   "orderId": "order_xyz",
 *   "paymentId": "pay_xyz"
 * }
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const { gateway, orderId, paymentId, signature, transactionId, amount } = req.body;

    // Validate gateway
    const gatewayValidation = validators.validateGateway(gateway);
    if (!gatewayValidation.valid) {
      return res.status(400).json({ error: gatewayValidation.error });
    }

    logger.info('Verifying payment', { gateway, orderId: orderId || transactionId });

    let verificationResult;

    switch (gateway.toLowerCase()) {
      case 'razorpay':
        if (!orderId || !paymentId || !signature) {
          return res.status(400).json({
            error: 'Missing required fields: orderId, paymentId, signature',
          });
        }

        const isValid = await razorpay.verifyRazorpaySignature({
          orderId,
          paymentId,
          signature,
        });

        if (!isValid) {
          return res.status(400).json({
            success: false,
            error: 'Payment signature verification failed',
          });
        }

        // Optionally fetch payment details from Razorpay
        const paymentDetails = await razorpay.getRazorpayPaymentDetails(paymentId);

        verificationResult = {
          success: true,
          gateway: 'razorpay',
          orderId,
          paymentId,
          status: paymentDetails.status,
          amount: paymentDetails.amount / 100, // Convert from paise to rupees
          method: paymentDetails.method,
          timestamp: new Date(paymentDetails.created_at * 1000).toISOString(),
        };
        break;

      case 'phonepe':
        if (!transactionId) {
          return res.status(400).json({
            error: 'Missing required field: transactionId',
          });
        }

        const phonepeStatus = await phonepe.checkPhonePeTransactionStatus(transactionId);

        if (!phonepeStatus.success) {
          return res.status(400).json({
            success: false,
            error: 'Payment verification failed',
            status: phonepeStatus.status,
          });
        }

        verificationResult = {
          success: true,
          gateway: 'phonepe',
          transactionId,
          status: phonepeStatus.status,
          amount: phonepeStatus.amount / 100, // Convert from paise
          responseCode: phonepeStatus.responseCode,
        };
        break;

      case 'cashfree':
        if (!orderId || !paymentId) {
          return res.status(400).json({
            error: 'Missing required fields: orderId, paymentId',
          });
        }

        const cashfreeDetails = await cashfree.getCashfreePaymentDetails(
          orderId,
          paymentId
        );

        if (cashfreeDetails.status !== 'SUCCESS') {
          return res.status(400).json({
            success: false,
            error: 'Payment verification failed',
            status: cashfreeDetails.status,
          });
        }

        verificationResult = {
          success: true,
          gateway: 'cashfree',
          orderId,
          paymentId: cashfreeDetails.paymentId,
          status: cashfreeDetails.status,
          amount: cashfreeDetails.amount,
          method: cashfreeDetails.method,
          timestamp: cashfreeDetails.timestamp,
        };
        break;

      default:
        return res.status(400).json({ error: 'Unsupported gateway' });
    }

    logger.info('Payment verified successfully', verificationResult);
    res.status(200).json(verificationResult);
  } catch (error) {
    logger.error('Error verifying payment', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed',
      ...(process.env.NODE_ENV === 'development' && { details: error }),
    });
  }
});

/**
 * GET /api/payment/status/:gateway/:id
 * Get payment status by transaction/order ID
 */
router.get('/status/:gateway/:id', async (req, res) => {
  try {
    const { gateway, id } = req.params;

    const gatewayValidation = validators.validateGateway(gateway);
    if (!gatewayValidation.valid) {
      return res.status(400).json({ error: gatewayValidation.error });
    }

    logger.info('Fetching payment status', { gateway, id });

    let status;

    switch (gateway.toLowerCase()) {
      case 'phonepe':
        status = await phonepe.checkPhonePeTransactionStatus(id);
        break;

      case 'cashfree':
        status = await cashfree.getCashfreeOrderDetails(id);
        break;

      case 'razorpay':
        status = await razorpay.getRazorpayPaymentDetails(id);
        break;

      default:
        return res.status(400).json({ error: 'Unsupported gateway' });
    }

    res.status(200).json({ success: true, status });
  } catch (error) {
    logger.error('Error fetching payment status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payment status',
    });
  }
});

export default router;
