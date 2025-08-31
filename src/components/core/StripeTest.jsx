import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { toast } from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { apiConnector } from '../../services/apiConnector';
import { stripeEndpoints } from '../../services/apis';
import { testStripeConnection, testCardValidation } from '../../services/operations/stripePaymentAPI';

// Hardcode the Stripe publishable key
const STRIPE_KEY = "pk_test_51RQ7H8DyqikyU0JVb8gbAiVBlXLAljPtLfhC74PduPl1EkHAumy56IR7R7CNYLweVF00GfLTVWzE7OwQF0ttKtUz00BZy9mq9U";
console.log("Using Stripe key in test component:", STRIPE_KEY);
const stripePromise = loadStripe(STRIPE_KEY);

// Simple test form component
const TestForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (stripe && elements) {
      setStripeReady(true);
      console.log("Stripe and Elements are ready");
    }
  }, [stripe, elements]);

  const handleTestPayment = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error("Stripe is not initialized yet");
      return;
    }

    setLoading(true);

    try {
      // Get the card element
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      // Test card validation using our helper function
      await testCardValidation(stripe, elements, cardElement);
    } catch (error) {
      console.error("Stripe test error:", error);
      toast.error(error.message || "Stripe test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-richblack-800 p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-richblack-5 mb-4">Test Card Validation</h2>

      <form onSubmit={handleTestPayment} className="flex flex-col gap-4">
        <div>
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
        </div>

        <div className="mt-2">
          <button
            type="submit"
            disabled={!stripeReady || loading}
            className={`w-full py-3 px-4 rounded-md font-medium ${
              !stripeReady || loading
                ? 'bg-richblack-600 text-richblack-300 cursor-not-allowed'
                : 'bg-yellow-50 text-black hover:bg-yellow-100'
            }`}
          >
            {loading ? "Testing..." : "Test Card Validation"}
          </button>
        </div>

        <div className="mt-2">
          <p className="text-sm text-richblack-300">
            Stripe Status: {stripeReady ? "Ready" : "Loading..."}
          </p>
        </div>
      </form>
    </div>
  );
};

function StripeTest() {
  const [loading, setLoading] = useState(false);
  const { token } = useSelector((state) => state.auth);

  const handleTestStripe = async () => {
    setLoading(true);
    try {
      await testStripeConnection();
    } catch (error) {
      console.error("Error testing Stripe:", error);
      toast.error("Failed to test Stripe connection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 gap-8">
      <h1 className="text-3xl font-bold text-richblack-5">Stripe Payment Test</h1>

      <div className="flex flex-col gap-6 w-full max-w-md">
        <div className="bg-richblack-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-richblack-5 mb-4">Test Stripe Connection</h2>
          <p className="text-richblack-300 mb-6">
            Click the button below to test if your Stripe integration is working correctly.
          </p>
          <button
            onClick={handleTestStripe}
            disabled={loading}
            className="bg-yellow-50 hover:bg-yellow-100 text-black font-bold py-2 px-4 rounded w-full"
          >
            {loading ? "Testing..." : "Test Stripe Connection"}
          </button>
        </div>

        <Elements stripe={stripePromise}>
          <TestForm />
        </Elements>

        <div className="bg-richblack-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-richblack-5 mb-4">About Stripe Test Mode</h2>
          <p className="text-richblack-300 mb-2">
            In test mode, you can use the following test card details:
          </p>
          <ul className="list-disc pl-5 text-richblack-300 space-y-1">
            <li>Card Number: 4242 4242 4242 4242</li>
            <li>Expiry: Any future date</li>
            <li>CVC: Any 3 digits</li>
            <li>ZIP: Any 5 digits</li>
          </ul>
        </div>
      </div>

      <div className="text-richblack-300 text-center max-w-md">
        <p>
          Stripe is integrated in test mode. No real payments will be processed.
          This is perfect for development and testing purposes.
        </p>
      </div>
    </div>
  );
}

export default StripeTest;
