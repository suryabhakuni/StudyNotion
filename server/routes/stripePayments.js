// Import the required modules
const express = require("express");
const router = express.Router();
const {
  createPaymentIntent,
  verifyPayment,
  sendPaymentSuccessEmail,
  stripeWebhook,
  testStripeConnection,
} = require("../controllers/stripePayments");
const { auth, isInstructor, isStudent, isAdmin } = require("../middleware/auth");

// Stripe webhook - no auth required
router.post("/webhook", express.raw({ type: 'application/json' }), stripeWebhook);

// Test endpoint to check Stripe connection
router.get("/test", testStripeConnection);

// Create a payment intent
router.post("/create-payment-intent", auth, isStudent, createPaymentIntent);

// Verify payment and enroll student
router.post("/verify-payment", auth, isStudent, verifyPayment);

// Send payment success email
router.post("/send-payment-success-email", auth, isStudent, sendPaymentSuccessEmail);

module.exports = router;
