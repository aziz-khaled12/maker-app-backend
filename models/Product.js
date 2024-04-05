
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  price: { type: Number, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  colors: { type: [String], required: true },
  materials: { type: [String], required: true },
  sizes: { type: [String], required: true },
  photos: { type: [String], required: true },
  categories: { type: [String], required: true },
  ratings: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'userModel' }, // User who provided the rating
      rating: { type: Number, min: 1, max: 5 },
      timestamp: { type: Date, default: Date.now },
    }
  ],
  averageRating: {
    type: Number,
    default: 0, 
  }
});
productSchema.index({ name: "text", description: "text" }); // Create text index
const productModel = mongoose.model('Product', productSchema);

export default productModel;
