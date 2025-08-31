import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm';
import { toast } from 'react-hot-toast';

// Use the publishable key from the .env file
// Hardcoding the key to ensure it works
const STRIPE_KEY = "pk_test_51RQ7H8DyqikyU0JVb8gbAiVBlXLAljPtLfhC74PduPl1EkHAumy56IR7R7CNYLweVF00GfLTVWzE7OwQF0ttKtUz00BZy9mq9U";
console.log("Using Stripe key:", STRIPE_KEY);
const stripePromise = loadStripe(STRIPE_KEY);

const StripePaymentPage = () => {
  const { user } = useSelector((state) => state.profile);
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      console.log("Location state:", location.state);

      // Get courses and amount from location state
      const { courses, amount } = location.state || {};

      if (!location.state) {
        throw new Error("No payment data provided");
      }

      if (!courses) {
        throw new Error("No courses selected for payment");
      }

      if (!amount) {
        throw new Error("Payment amount is missing");
      }

      if (courses.length === 0) {
        throw new Error("No courses in cart");
      }

      console.log("Courses for payment:", courses);
      console.log("Payment amount:", amount);

      setCourses(courses);
      setTotalAmount(amount);
      setLoading(false);
    } catch (error) {
      console.error("Error in payment page:", error);
      toast.error(error.message || "Error loading payment page");
      navigate("/dashboard/cart");
    }
  }, [location.state, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-3.5rem)]">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="bg-richblack-900 min-h-[calc(100vh-3.5rem)] py-10">
      <div className="w-11/12 max-w-maxContent mx-auto">
        <h1 className="text-3xl font-semibold text-richblack-5 mb-6">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column - Course summary */}
          <div className="lg:col-span-7">
            <div className="bg-richblack-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-richblack-5 mb-4">Order Summary</h2>

              {/* Course list */}
              <div className="space-y-4 mb-6">
                {courses.map((course) => (
                  <div key={course._id} className="flex gap-3 border-b border-richblack-700 pb-4">
                    <img
                      src={course.thumbnail}
                      alt={course.courseName}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                    <div>
                      <h3 className="text-richblack-5 font-medium">{course.courseName}</h3>
                      <p className="text-richblack-300 text-sm">{course.category?.name || 'Uncategorized'}</p>
                      <p className="text-yellow-50">₹ {course.price}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price summary */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-richblack-300">Subtotal:</span>
                  <span className="text-richblack-5">₹ {totalAmount}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-richblack-300">Total:</span>
                  <span className="text-yellow-50">₹ {totalAmount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Payment form */}
          <div className="lg:col-span-5">
            <Elements stripe={stripePromise}>
              <CheckoutForm
                courses={courses.map(course => course._id)}
                amount={totalAmount}
              />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripePaymentPage;
