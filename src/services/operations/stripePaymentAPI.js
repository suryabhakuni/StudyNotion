import { toast } from "react-hot-toast";
import { loadStripe } from "@stripe/stripe-js";
import { resetCart } from "../../slices/cartSlice";
import { setPaymentLoading } from "../../slices/courseSlice";
import { apiConnector } from "../apiConnector";
import { stripeEndpoints } from "../apis";

const {
  STRIPE_PAYMENT_API,
  STRIPE_VERIFY_API,
  STRIPE_SEND_SUCCESS_EMAIL_API,
} = stripeEndpoints;

// Load the Stripe.js library
const loadStripeJS = async () => {
  try {
    // Use the publishable key from the .env file
    return await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || "pk_test_51RQ7H8DyqikyU0JVb8gbAiVBlXLAljPtLfhC74PduPl1EkHAumy56IR7R7CNYLweVF00GfLTVWzE7OwQF0ttKtUz00BZy9mq9U");
  } catch (error) {
    console.error("Error loading Stripe:", error);
    toast.error("Could not load payment system. Please try again later.");
    return null;
  }
};

// Buy the Course with Stripe
export async function BuyCourseWithStripe(
  token,
  courses,
  user_details,
  navigate,
  dispatch
) {
  const toastId = toast.loading("Processing payment...");
  try {
    dispatch(setPaymentLoading(true));

    console.log("BuyCourseWithStripe called with courses:", courses);
    console.log("User details:", user_details);

    // Validate input parameters
    if (!token) {
      toast.error("Authentication token is missing");
      toast.dismiss(toastId);
      dispatch(setPaymentLoading(false));
      return;
    }

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      toast.error("No courses selected for purchase");
      toast.dismiss(toastId);
      dispatch(setPaymentLoading(false));
      return;
    }

    // Load Stripe.js
    const stripe = await loadStripeJS();
    if (!stripe) {
      toast.dismiss(toastId);
      dispatch(setPaymentLoading(false));
      return;
    }

    // Create a payment intent on the server
    const response = await apiConnector(
      "POST",
      STRIPE_PAYMENT_API,
      { courses },
      { Authorization: `Bearer ${token}` }
    );

    if (!response.data.success) {
      throw new Error(response.data.message);
    }

    console.log("Payment intent created:", response.data);

    // Use the client secret to confirm the payment
    const { clientSecret, amount } = response.data;

    // Redirect to the Stripe Checkout page
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: {
          // In a real application, you would use Elements to collect card details
          // For testing, we'll use a test card number
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2024,
          cvc: '123',
        },
        billing_details: {
          name: `${user_details.firstName} ${user_details.lastName}`,
          email: user_details.email,
        },
      },
    });

    if (result.error) {
      // Show error to your customer
      console.error("Payment failed:", result.error);
      toast.error(result.error.message);
      dispatch(setPaymentLoading(false));
      toast.dismiss(toastId);
      return;
    }

    if (result.paymentIntent.status === 'succeeded') {
      // Payment succeeded, verify on the server and enroll the student
      const verifyResponse = await apiConnector(
        "POST",
        STRIPE_VERIFY_API,
        {
          paymentIntentId: result.paymentIntent.id,
          courses,
        },
        { Authorization: `Bearer ${token}` }
      );

      if (!verifyResponse.data.success) {
        throw new Error(verifyResponse.data.message);
      }

      // Send success email
      await apiConnector(
        "POST",
        STRIPE_SEND_SUCCESS_EMAIL_API,
        {
          paymentIntentId: result.paymentIntent.id,
          amount,
        },
        { Authorization: `Bearer ${token}` }
      );

      toast.success("Payment successful! You are now enrolled in the course(s)");
      navigate("/dashboard/enrolled-courses");
      dispatch(resetCart());
    }
  } catch (error) {
    console.log("PAYMENT ERROR:", error);
    toast.error("Payment failed: " + (error.message || "Unknown error"));
  } finally {
    toast.dismiss(toastId);
    dispatch(setPaymentLoading(false));
  }
}

// Test Stripe Connection
export async function testStripeConnection() {
  const toastId = toast.loading("Testing Stripe connection...");
  try {
    const response = await apiConnector("GET", stripeEndpoints.STRIPE_TEST_API);

    if (response.data.success) {
      toast.success("Stripe connection is working!");
      console.log("Stripe test response:", response.data);
      return true;
    } else {
      toast.error("Stripe connection test failed");
      return false;
    }
  } catch (error) {
    console.error("Stripe test error:", error);
    toast.error("Could not connect to Stripe: " + (error.message || "Unknown error"));
    return false;
  } finally {
    toast.dismiss(toastId);
  }
}

// Test Card Validation
export async function testCardValidation(stripe, elements, cardElement) {
  const toastId = toast.loading("Testing card validation...");
  try {
    if (!stripe || !elements || !cardElement) {
      throw new Error("Stripe is not properly initialized");
    }

    // Create a payment method to validate the card
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log("Payment method created:", paymentMethod);
    toast.success("Card validation successful!");
    return true;
  } catch (error) {
    console.error("Card validation error:", error);
    toast.error("Card validation failed: " + (error.message || "Unknown error"));
    return false;
  } finally {
    toast.dismiss(toastId);
  }
}
