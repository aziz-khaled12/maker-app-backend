import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  liked: {
    type: [''], // Assuming this stores product IDs or some other reference
  },
  orders: {
    type: [''], // Assuming this stores order IDs or details
  },
  // Additional fields for rating system:
  ratings: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'userModel' }, // User who provided the rating
      rating: { type: Number, min: 1, max: 5 },
      timestamp: { type: Date, default: Date.now },
    }
  ],
  averageRating: {
    type: Number,
    default: 0, // Initially set to 0
  }
});

// ... existing middleware for password hashing

const userModel = mongoose.model('User', userSchema);
export default userModel;
