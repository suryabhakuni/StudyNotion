const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Log Stripe configuration
console.log("Initializing Stripe with secret key:", 
  process.env.STRIPE_SECRET_KEY ? 
  `${process.env.STRIPE_SECRET_KEY.substring(0, 8)}...` : 
  "undefined");

// Validate Stripe keys
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
  console.error("ERROR: Stripe API keys are missing or undefined!");
  console.error("Make sure STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are defined in your .env file");
}

module.exports = stripe;
