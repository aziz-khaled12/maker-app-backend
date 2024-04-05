// models/order.js
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  size: String,
  color: String,
  material: String,
  quantity: Number,
  total: Number,
  state: String, 
  address: String,
  phone: String
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

export default Order;
