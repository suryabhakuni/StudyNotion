const Razorpay = require("razorpay");

// Log Razorpay configuration
console.log("Initializing Razorpay with key_id:", process.env.RAZORPAY_KEY);
console.log("RAZORPAY_SECRET is defined:", !!process.env.RAZORPAY_SECRET);

// Validate Razorpay keys
if (!process.env.RAZORPAY_KEY || !process.env.RAZORPAY_SECRET) {
    console.error("ERROR: Razorpay API keys are missing or undefined!");
    console.error("Make sure RAZORPAY_KEY and RAZORPAY_SECRET are defined in your .env file");
}

// Create a direct instance without async testing
// This is more reliable and avoids potential issues with async initialization
const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});

// Wrap the orders.create method to add better error handling
const originalCreate = instance.orders.create;
instance.orders.create = async function(options) {
    try {
        console.log("Calling Razorpay API with options:", JSON.stringify(options));
        const result = await originalCreate.call(this, options);
        console.log("Razorpay API response:", JSON.stringify(result));
        return result;
    } catch (error) {
        console.error("Razorpay API error:", error);
        // Enhance the error with more details
        if (!error.message) {
            error.message = "Failed to create Razorpay order";
        }
        throw error;
    }
};

exports.instance = instance;
