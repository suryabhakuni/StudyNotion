// Import the required modules
const express = require("express")
const router = express.Router()
const {
  capturePayment,
  // verifySignature,
  verifyPayment,
  sendPaymentSuccessEmail,
} = require("../controllers/payments")
const { auth, isInstructor, isStudent, isAdmin } = require("../middleware/auth")
const { instance } = require("../config/razorpay")
const Razorpay = require("razorpay")

// Add a test endpoint to check Razorpay connection
router.get("/razorpay-test", async (req, res) => {
  try {
    // Try to fetch a list of orders to test the connection
    const result = await instance.orders.all({
      count: 1  // Just get one order to minimize data transfer
    })

    return res.status(200).json({
      success: true,
      message: "Razorpay connection is working",
      data: { count: result.count }
    })
  } catch (error) {
    console.error("Razorpay test failed:", error)
    return res.status(500).json({
      success: false,
      message: "Razorpay connection test failed",
      error: error.message
    })
  }
})

// Add a simple test order endpoint that doesn't rely on course data
router.post("/test-order", async (req, res) => {
  try {
    console.log("Creating test order...")

    // Create a simple order with fixed values
    const options = {
      amount: 50000, // 500 INR
      currency: "INR",
      receipt: "test_receipt_" + Date.now(),
    }

    console.log("Test order options:", options)

    try {
      // Create the order
      const order = await instance.orders.create(options)
      console.log("Test order created successfully:", order)

      return res.status(200).json({
        success: true,
        message: "Test order created successfully",
        data: order
      })
    } catch (razorpayError) {
      console.error("Razorpay API error details:", razorpayError)

      // Check if it's a network error
      if (razorpayError.code === 'ECONNREFUSED' || razorpayError.code === 'ENOTFOUND') {
        return res.status(500).json({
          success: false,
          message: "Cannot connect to Razorpay servers. Please check your internet connection.",
          error: razorpayError.message
        })
      }

      // Check if it's an authentication error
      if (razorpayError.statusCode === 401) {
        return res.status(500).json({
          success: false,
          message: "Invalid Razorpay API keys. Please check your configuration.",
          error: razorpayError.message
        })
      }

      // Generic error
      return res.status(500).json({
        success: false,
        message: "Failed to create Razorpay order: " + (razorpayError.message || "Unknown error"),
        error: razorpayError
      })
    }
  } catch (error) {
    console.error("Test order creation failed:", error)
    return res.status(500).json({
      success: false,
      message: "Test order creation failed",
      error: error.message,
      stack: error.stack
    })
  }
})

// Direct test endpoint that bypasses all middleware and uses Razorpay directly
router.get("/direct-test", async (req, res) => {
  try {
    console.log("Testing direct Razorpay connection...")

    // Create a new instance directly with the keys from .env
    const directInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    // Create a simple test order
    const options = {
      amount: 10000, // 100 INR
      currency: "INR",
      receipt: "direct_test_" + Date.now(),
    };

    console.log("Direct test options:", options);

    // Try to create an order
    const order = await directInstance.orders.create(options);
    console.log("Direct test successful:", order);

    return res.status(200).json({
      success: true,
      message: "Direct Razorpay test successful",
      data: order
    });
  } catch (error) {
    console.error("Direct Razorpay test failed:", error);
    return res.status(500).json({
      success: false,
      message: "Direct Razorpay test failed",
      error: error.message,
      stack: error.stack
    });
  }
});

router.post("/capturePayment", auth, isStudent, capturePayment)
router.post("/verifyPayment", auth, isStudent, verifyPayment)
router.post(
  "/sendPaymentSuccessEmail",
  auth,
  isStudent,
  sendPaymentSuccessEmail
)
// router.post("/verifySignature", verifySignature)

module.exports = router
