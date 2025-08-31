const stripe = require("../config/stripe");
const Course = require("../models/Course");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const mongoose = require("mongoose");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");
const CourseProgress = require("../models/CourseProgress");

// Test Stripe connection
exports.testStripeConnection = async (req, res) => {
  try {
    console.log("Testing Stripe connection");

    // Check if Stripe is properly initialized
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe is not properly initialized"
      });
    }

    // Try to create a simple test customer to verify Stripe API works
    const customer = await stripe.customers.create({
      email: "test@example.com",
      name: "Test Customer",
      metadata: {
        test: "true"
      }
    });

    console.log("Stripe test successful, created customer:", customer.id);

    return res.status(200).json({
      success: true,
      message: "Stripe connection is working properly",
      stripeVersion: stripe.VERSION,
      testCustomerId: customer.id
    });
  } catch (error) {
    console.error("Stripe test failed:", error);

    return res.status(500).json({
      success: false,
      message: "Stripe connection test failed: " + error.message,
      error: error
    });
  }
};

// Create a payment intent with Stripe
exports.createPaymentIntent = async (req, res) => {
  try {
    console.log("createPaymentIntent called with body:", req.body);
    const { courses } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.log("User not authenticated");
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const userId = req.user.id;
    console.log("User ID:", userId);
    console.log("Courses:", courses);

    if (!courses || courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please Provide Course ID"
      });
    }

    let total_amount = 0;
    let processedCourses = [];

    // Process each course
    for (const course_id of courses) {
      try {
        console.log("Looking up course with ID:", course_id);

        // Find the course by its ID
        const course = await Course.findById(course_id);

        // If the course is not found, return an error
        if (!course) {
          console.log("Course not found with ID:", course_id);
          return res.status(404).json({
            success: false,
            message: `Could not find the Course with ID: ${course_id}`
          });
        }

        console.log("Found course:", course.courseName, "with price:", course.price);

        // Check if the user is already enrolled in the course
        const uid = new mongoose.Types.ObjectId(userId);
        if (course.studentsEnroled.includes(uid)) {
          console.log("User already enrolled in course:", course.courseName);
          return res.status(400).json({
            success: false,
            message: `Student is already Enrolled in course: ${course.courseName}`
          });
        }

        // Validate course price
        if (typeof course.price !== 'number' || isNaN(course.price)) {
          console.log("Invalid course price:", course.price);
          return res.status(400).json({
            success: false,
            message: `Invalid price for course: ${course.courseName}`
          });
        }

        // Add course to processed courses and update total amount
        processedCourses.push(course);
        total_amount += course.price;
        console.log("Running total amount:", total_amount);

      } catch (error) {
        console.log("Error processing course:", error);
        return res.status(500).json({
          success: false,
          message: `Error processing course: ${error.message}`,
          error: error.stack
        });
      }
    }

    // Create a payment intent with Stripe
    try {
      // Convert amount to cents (Stripe requires amount in smallest currency unit)
      const amountInCents = Math.round(total_amount * 100);

      // Create the payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "inr",
        metadata: {
          userId: userId,
          courses: JSON.stringify(courses),
        },
      });

      console.log("Stripe payment intent created successfully:", paymentIntent.id);

      return res.status(200).json({
        success: true,
        message: "Payment intent created successfully",
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: total_amount,
      });
    } catch (stripeError) {
      console.error("Stripe payment intent creation failed:", stripeError);

      return res.status(500).json({
        success: false,
        message: "Failed to create payment intent: " + stripeError.message,
        error: stripeError
      });
    }

  } catch (error) {
    console.error("Unexpected error in createPaymentIntent:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred: " + error.message,
      error: error.stack
    });
  }
};

// Handle successful payment and enroll student
exports.stripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;

    // Extract metadata
    const userId = paymentIntent.metadata.userId;
    const courses = JSON.parse(paymentIntent.metadata.courses);

    // Enroll the student in the courses
    try {
      await enrollStudents(courses, userId);
      console.log('Student enrolled successfully after payment');
    } catch (error) {
      console.error('Error enrolling student after payment:', error);
    }
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
};

// Verify payment and enroll student (for client-side confirmation)
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId, courses } = req.body;
    const userId = req.user.id;

    if (!paymentIntentId || !courses || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters"
      });
    }

    // Retrieve the payment intent from Stripe to verify its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Enroll the student in the courses
      await enrollStudents(courses, userId, res);

      return res.status(200).json({
        success: true,
        message: "Payment verified and student enrolled"
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Payment has not been completed"
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message
    });
  }
};

// Send payment success email
exports.sendPaymentSuccessEmail = async (req, res) => {
  const { paymentIntentId, amount } = req.body;
  const userId = req.user.id;

  if (!paymentIntentId || !amount || !userId) {
    return res.status(400).json({
      success: false,
      message: "Please provide all the details"
    });
  }

  try {
    const enrolledStudent = await User.findById(userId);

    await mailSender(
      enrolledStudent.email,
      `Payment Received`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount,
        paymentIntentId,
        paymentIntentId
      )
    );

    return res.status(200).json({
      success: true,
      message: "Payment success email sent"
    });
  } catch (error) {
    console.log("error in sending mail", error);
    return res.status(400).json({
      success: false,
      message: "Could not send email"
    });
  }
};

// Helper function to enroll students in courses
const enrollStudents = async (courses, userId, res) => {
  if (!courses || !userId) {
    if (res) {
      return res.status(400).json({
        success: false,
        message: "Please Provide Course ID and User ID"
      });
    }
    throw new Error("Missing course IDs or user ID");
  }

  for (const courseId of courses) {
    try {
      // Find the course and enroll the student in it
      const enrolledCourse = await Course.findOneAndUpdate(
        { _id: courseId },
        { $push: { studentsEnroled: userId } },
        { new: true }
      );

      if (!enrolledCourse) {
        if (res) {
          return res.status(500).json({
            success: false,
            error: "Course not found"
          });
        }
        throw new Error(`Course not found: ${courseId}`);
      }

      console.log("Updated course: ", enrolledCourse);

      const courseProgress = await CourseProgress.create({
        courseID: courseId,
        userId: userId,
        completedVideos: [],
      });

      // Find the student and add the course to their list of enrolled courses
      const enrolledStudent = await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            courses: courseId,
            courseProgress: courseProgress._id,
          },
        },
        { new: true }
      );

      console.log("Enrolled student: ", enrolledStudent);

      // Send an email notification to the enrolled student
      const emailResponse = await mailSender(
        enrolledStudent.email,
        `Successfully Enrolled into ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          `${enrolledStudent.firstName} ${enrolledStudent.lastName}`
        )
      );

      console.log("Email sent successfully: ", emailResponse.response);
    } catch (error) {
      console.log(error);
      if (res) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      throw error;
    }
  }
};
