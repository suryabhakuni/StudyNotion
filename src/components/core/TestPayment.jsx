import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { apiConnector } from '../../services/apiConnector';
import { useSelector } from 'react-redux';

function TestPayment() {
  const [loading, setLoading] = useState(false);
  const { token } = useSelector((state) => state.auth);

  const testRazorpayConnection = async () => {
    setLoading(true);
    try {
      const response = await apiConnector(
        "GET",
        "http://localhost:4000/api/v1/payment/razorpay-test",
        null,
        {
          Authorization: `Bearer ${token}`,
        }
      );

      console.log("Razorpay test response:", response.data);
      toast.success("Razorpay connection test successful!");
    } catch (error) {
      console.error("Razorpay test failed:", error);
      toast.error("Razorpay connection test failed!");
    } finally {
      setLoading(false);
    }
  };

  const testCreateOrder = async () => {
    setLoading(true);
    try {
      // Use the simple test order endpoint that doesn't rely on course data
      const response = await apiConnector(
        "POST",
        "http://localhost:4000/api/v1/payment/test-order",
        null,
        {
          Authorization: `Bearer ${token}`,
        }
      );

      console.log("Test order response:", response.data);

      if (response.data.success) {
        toast.success("Test order created successfully!");

        // If order was created successfully, try to open Razorpay
        const options = {
          key: "rzp_test_7AapDyubbnACqG", // Hardcoded for testing
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          order_id: response.data.data.id,
          name: "StudyNotion Test",
          description: "Test Payment",
          handler: function(response) {
            console.log("Payment successful:", response);
            toast.success("Test payment successful!");
          },
          prefill: {
            name: "Test User",
            email: "test@example.com",
          },
          theme: {
            color: "#3399cc",
          },
        };

        // Load Razorpay script
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
          const paymentObject = new window.Razorpay(options);
          paymentObject.open();
        };
        document.body.appendChild(script);
      }
    } catch (error) {
      console.error("Test order creation failed:", error);
      toast.error("Test order creation failed: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      <h1 className="text-2xl font-bold mb-4">Payment System Test</h1>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <button
          onClick={testRazorpayConnection}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? "Testing..." : "Test Razorpay Connection"}
        </button>

        <button
          onClick={testCreateOrder}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? "Creating..." : "Test Create Order"}
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>Check the console for detailed test results</p>
      </div>
    </div>
  );
}

export default TestPayment;
