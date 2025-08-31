const { instance } = require("../config/razorpay")
const Course = require("../models/Course")
const crypto = require("crypto")
const User = require("../models/User")
const mailSender = require("../utils/mailSender")
const mongoose = require("mongoose")
const {
  courseEnrollmentEmail,
} = require("../mail/templates/courseEnrollmentEmail")
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail")
const CourseProgress = require("../models/CourseProgress")

// Capture the payment and initiate the Razorpay order
exports.capturePayment = async (req, res) => {
  try {
    console.log("capturePayment called with body:", req.body);
    const { courses } = req.body

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      console.log("User not authenticated");
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const userId = req.user.id
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

    // Create Razorpay order options
    const options = {
      amount: total_amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now().toString(),
    };

    console.log("Creating Razorpay order with options:", options);

    try {
      // Create the Razorpay order
      const paymentResponse = await instance.orders.create(options);
      console.log("Razorpay order created successfully:", paymentResponse);

      return res.status(200).json({
        success: true,
        message: "Order created successfully",
        data: paymentResponse,
      });
    } catch (razorpayError) {
      console.error("Razorpay order creation failed:", razorpayError);

      return res.status(500).json({
        success: false,
        message: "Failed to create Razorpay order: " + razorpayError.message,
        error: razorpayError.stack
      });
    }

  } catch (error) {
    console.error("Unexpected error in capturePayment:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred: " + error.message,
      error: error.stack
    });
  }
}

// verify the payment
exports.verifyPayment = async (req, res) => {
  const razorpay_order_id = req.body?.razorpay_order_id
  const razorpay_payment_id = req.body?.razorpay_payment_id
  const razorpay_signature = req.body?.razorpay_signature
  const courses = req.body?.courses

  const userId = req.user.id

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !courses ||
    !userId
  ) {
    return res.status(200).json({ success: false, message: "Payment Failed" })
  }

  let body = razorpay_order_id + "|" + razorpay_payment_id

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body.toString())
    .digest("hex")

  if (expectedSignature === razorpay_signature) {
    await enrollStudents(courses, userId, res)
    return res.status(200).json({ success: true, message: "Payment Verified" })
  }

  return res.status(200).json({ success: false, message: "Payment Failed" })
}

// Send Payment Success Email
exports.sendPaymentSuccessEmail = async (req, res) => {
  const { orderId, paymentId, amount } = req.body

  const userId = req.user.id

  if (!orderId || !paymentId || !amount || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide all the details" })
  }

  try {
    const enrolledStudent = await User.findById(userId)

    await mailSender(
      enrolledStudent.email,
      `Payment Received`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
        orderId,
        paymentId
      )
    )
  } catch (error) {
    console.log("error in sending mail", error)
    return res
      .status(400)
      .json({ success: false, message: "Could not send email" })
  }
}

// enroll the student in the courses
const enrollStudents = async (courses, userId, res) => {
  if (!courses || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please Provide Course ID and User ID" })
  }

  for (const courseId of courses) {
    try {
      // Find the course and enroll the student in it
      const enrolledCourse = await Course.findOneAndUpdate(
        { _id: courseId },
        { $push: { studentsEnroled: userId } },
        { new: true }
      )

      if (!enrolledCourse) {
        return res
          .status(500)
          .json({ success: false, error: "Course not found" })
      }
      console.log("Updated course: ", enrolledCourse)

      const courseProgress = await CourseProgress.create({
        courseID: courseId,
        userId: userId,
        completedVideos: [],
      })
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
      )

      console.log("Enrolled student: ", enrolledStudent)
      // Send an email notification to the enrolled student
      const emailResponse = await mailSender(
        enrolledStudent.email,
        `Successfully Enrolled into ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          `${enrolledStudent.firstName} ${enrolledStudent.lastName}`
        )
      )

      console.log("Email sent successfully: ", emailResponse.response)
    } catch (error) {
      console.log(error)
      return res.status(400).json({ success: false, error: error.message })
    }
  }
}