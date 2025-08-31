import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { apiConnector } from '../../../services/apiConnector';
import { stripeEndpoints } from '../../../services/apis';
import { resetCart } from '../../../slices/cartSlice';
import IconBtn from '../../Common/IconBtn';

const CheckoutForm = ({ courses, amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { token } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.profile);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet
      toast.error("Payment system is still loading. Please try again in a moment.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Processing payment...");

    console.log("Stripe object:", stripe);
    console.log("Elements object:", elements);

    try {
      // Create a payment intent on the server
      console.log("Creating payment intent for courses:", courses);
      const response = await apiConnector(
        "POST",
        stripeEndpoints.STRIPE_PAYMENT_API,
        { courses },
        { Authorization: `Bearer ${token}` }
      );

      console.log("Payment intent response:", response);

      if (!response || !response.data) {
        throw new Error("No response from payment server");
      }

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to create payment");
      }

      const { clientSecret } = response.data;

      if (!clientSecret) {
        throw new Error("No client secret received from payment server");
      }

      console.log("Received client secret:", clientSecret);

      // Use the client secret to confirm the payment
      console.log("Confirming card payment with client secret");

      // Make sure user data is available
      if (!user || !user.firstName || !user.lastName || !user.email) {
        throw new Error("User information is missing");
      }

      // Get the card element
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
          },
        },
      });

      console.log("Payment confirmation result:", result);

      if (result.error) {
        // Show error to your customer
        console.error("Payment confirmation error:", result.error);
        throw new Error(result.error.message);
      } else if (!result.paymentIntent) {
        throw new Error("Payment intent not found in result");
      } else if (result.paymentIntent.status === 'succeeded') {
        // Payment succeeded, verify on the server and enroll the student
        const verifyResponse = await apiConnector(
          "POST",
          stripeEndpoints.STRIPE_VERIFY_API,
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
          stripeEndpoints.STRIPE_SEND_SUCCESS_EMAIL_API,
          {
            paymentIntentId: result.paymentIntent.id,
            amount,
          },
          { Authorization: `Bearer ${token}` }
        );

        toast.success("Payment successful! You are now enrolled in the course(s)");
        dispatch(resetCart());
        navigate("/dashboard/enrolled-courses");
      }
    } catch (error) {
      console.error("Payment failed:", error);

      // Provide more detailed error messages
      let errorMessage = "Payment failed";

      if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      if (error.response) {
        console.error("Error response:", error.response);
        if (error.response.data && error.response.data.message) {
          errorMessage += ` - ${error.response.data.message}`;
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
      toast.dismiss(toastId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 bg-richblack-800 rounded-lg">
      <h2 className="text-xl font-semibold text-richblack-5 mb-4">Complete your purchase</h2>

      <div className="mb-4">
        <label className="text-sm text-richblack-300 mb-1 block">Card details</label>
        <div className="p-3 border border-richblack-700 rounded-md bg-richblack-900">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#FFFFFF',
                  '::placeholder': {
                    color: '#AAAAAA',
                  },
                },
                invalid: {
                  color: '#EF4444',
                },
              },
            }}
          />
        </div>
        <p className="text-xs text-richblack-300 mt-1">
          Test card: 4242 4242 4242 4242 | Exp: Any future date | CVC: Any 3 digits
        </p>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex justify-between">
          <span className="text-richblack-300">Subtotal:</span>
          <span className="text-richblack-5">₹ {amount}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-richblack-300">Total:</span>
          <span className="text-yellow-50">₹ {amount}</span>
        </div>
      </div>

      <IconBtn
        text={loading ? "Processing..." : `Pay ₹${amount}`}
        disabled={!stripe || loading}
        type="submit"
        customClasses="w-full justify-center"
      />
    </form>
  );
};

export default CheckoutForm;
