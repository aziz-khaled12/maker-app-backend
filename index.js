import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
import path from "path";
import { JWT_SECRET, PORT, mongoDBURL } from "./config.js";
import userModel from "./models/user.js";
import productModel from "./models/Product.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import Order from "./models/Order.js";
const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(
  cors({
    origin: ["https://maker-app-frontend.vercel.app"],
    credentials: true,
  })
);

mongoose
  .connect(mongoDBURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    userModel.createIndexes({ username: 1 }, { unique: true });
    userModel.createIndexes({ email: 1 }, { unique: true });
    console.log("App is connected to the database");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });

app.post("/api/register", async (req, res) => {
  try {
    const userData = req.body;

    const user = new userModel({
      username: userData.username,
      email: userData.email,
      role: userData.role,
      password: userData.password,
    });

    const savedUser = await user.save();

    res.status(201).json(savedUser);
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern.username) {
        return res.status(400).json({ error: "Username already taken" });
      } else if (error.keyPattern.email) {
        return res.status(400).json({ error: "Email already taken" });
      }
    } else {
      console.error("Error saving user:", error);
      res.status(500).send("Error saving user to the database");
    }
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const passwordMatch = await argon2.verify(user.password, password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "100y",
    });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Error during login" });
  }
});

app.use(express.static("uploads"));

app.get("/api/profile", authenticateUser, (req, res) => {
  res.status(200).json({ user: req.user });
});

function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  const decodedToken = jwt.decode(token);

  console.log(decodedToken);

  if (!token) {
    return res
      .status(401)
      .json({ error: "Authentication required - No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      console.error("Error authenticating user:", error);
      return res.status(401).json({ error: "Invalid token" });
    } else if (error.name === "TokenExpiredError") {
      console.error("Error authenticating user:", error);
      return res.status(401).json({ error: "Token expired" });
    } else {
      console.error("Error authenticating user:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/photos");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + extension);
  },
});

const upload = multer({ storage: storage });
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

app.post(
  "/products",
  authenticateUser,
  upload.array("photos"),
  async (req, res) => {
    try {
      console.log(req.user.role);
      if (req.user.role !== "seller") {
        return res
          .status(403)
          .json({ error: "Only sellers are allowed to add products" });
      }

      const productData = req.body;
      const photos = req.files.map((file) => path.basename(file.path)); // Get paths of all uploaded files
      const product = new productModel({
        sellerId: productData.sellerId,
        price: productData.price,
        name: productData.name,
        description: productData.description,
        colors: productData.colors,
        materials: productData.materials,
        sizes: productData.sizes,
        photos: photos,
        categories: productData.categories,
      });
      const savedProduct = await product.save();

      // Log paths of all uploaded files
      photos.forEach((path) => {
        console.log("File uploaded:", path);
      });

      res.status(201).json(savedProduct);
    } catch (error) {
      console.error("Error adding product:", error);
      res.status(500).send("Error adding product to the database");
    }
  }
);

app.get("/users/:userId/liked", async (req, res) => {
  try {
    const userId = req.params.userId;

    res.status(200).json(productId);
  } catch (error) {
    res.status(500).send("Error adding product to the database");
  }
});

app.put("/user/:userId/liked/:productId", async (req, res) => {
  try {
    const userId = req.params.userId; // Get user ID from decoded token
    const productId = req.params.productId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isLiked = user.liked.includes(productId);

    if (isLiked) {
      const index = user.liked.indexOf(productId);
      if (index > -1) {
        user.liked.splice(index, 1);
        const updatedUser = await user.save();
        res.status(200).json({ message: "Product successfully unliked!" });
      }
    } else {
      user.liked.push(productId);
      const updatedUser = await user.save();
      res.status(200).json({ message: "Product successfully liked!" });
    }
  } catch (error) {
    console.error("Error liking/unliking product:", error);
    res.status(500).json({ error: "Error liking/unliking product" });
  }
});

app.get("/products", async (req, res) => {
  try {
    const products = await productModel.find({});

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ error: "Error fetching products from the database" });
  }
});

app.get("/products/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await productModel.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Error fetching product from the database" });
  }
});

app.get("/sellers", async (req, res) => {
  try {
    const users = await userModel.find({ role: "seller" });

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Error fetching users from the database" });
  }
});

app.get("/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await userModel.findById(userId);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users from the database" });
  }
});

app.put("/sellers/:sellerId/orders", async (req, res) => {
  const { sellerId } = req.params;
  const { orderId } = req.body;

  try {
    // Find the seller by ID
    const seller = await userModel.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    // Push the new orderId into the orders array
    seller.orders.push(orderId);
    await seller.save();

    // Respond with success message
    res.status(200).json({ message: "Seller orders updated successfully" });
  } catch (error) {
    console.error("Error updating seller orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/sellers/:sellerId/orders", async (req, res) => {
  const { sellerId } = req.params;
  try {
    const seller = await userModel.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }
    const orders = await Promise.all(
      seller.orders.map(async (orderId) => {
        const order = await Order.findById(orderId);
        return order;
      })
    );

    const completed = await Order.find({
      _id: { $in: seller.orders },
      state: "completed",
    }).sort("-createdAt");
    const numCompleted = completed.length;

    const pending = await Order.find({
      _id: { $in: seller.orders },
      state: "pending",
    }).sort("-createdAt");
    const numPending = pending.length;

    const shipped = await Order.find({
      _id: { $in: seller.orders },
      state: "shipped",
    }).sort("-createdAt");
    const numShipped = shipped.length;

    const cancelled = await Order.find({
      _id: { $in: seller.orders },
      state: "cancelled",
    }).sort("-createdAt");
    const numCancelled = cancelled.length;

    const totalOrders = orders.length;
    let totalIncome = 0;

    completed.forEach((order) => {
      totalIncome += order.total;
    });

    const responseData = {
      orders: orders,
      totalOrders: totalOrders,
      completed: completed,
      numCompleted: numCompleted,
      pending: pending,
      numPending: numPending,
      shipped: shipped,
      numShipped: numShipped,
      cancelled: cancelled,
      numCancelled: numCancelled,
      totalIncome: totalIncome,
    };
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error getting seller orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/sellers/:sellerId/sellerProducts", async (req, res) => {
  try {
    const { sellerId } = req.params;
    const seller = await userModel.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }
    const products = await productModel.find({ sellerId: sellerId });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/products/categories/:category", async (req, res) => {
  const category = req.params.category;

  try {
    const products1 = await productModel.find({ categories: category });
    res.status(200).json(products1);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await userModel.find();
    res.status(200).json(users);
  } catch (error) {
    console.error("cant fetch users", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/logout", (req, res) => {
  try {
    console.log("User logged out successfully");

    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ error: "Error during logout" });
  }
});

app.post("/api/orders", authenticateUser, async (req, res) => {
  try {
    const { userId, productId, size, color, quantity, total } = req.body;
    const state = "pending";
    const order = new Order({
      userId,
      productId,
      size,
      color,
      total,
      quantity,
      state,
    });

    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Error creating order" });
  }
});

app.get("/product/filter", async (req, res) => {
  try {
    let query = {};

    if (req.query.categories) {
      query.categories = { $in: req.query.categories.split(",") };
    }
    if (req.query.colors) {
      query.colors = { $in: req.query.colors.split(",") };
    }
    if (req.query.priceRanges) {
      const [minPrice, maxPrice] = req.query.priceRanges.split("-").map(Number);
      query.price = { $gte: minPrice, $lte: maxPrice };
    }
    if (req.query.minPrice && req.query.maxPrice) {
      // Handle custom price range
      query.price = {
        $gte: parseInt(req.query.minPrice),
        $lte: parseInt(req.query.maxPrice),
      };
    }

    const products = await productModel.find(query);

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ error: "Error fetching products from the database" });
  }
});

app.put("/:sellerId/orders/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  const newState = req.body.status;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    order.state = newState;

    await order.save();
    console.log(order);

    return res.status(200).send("Order state updated successfully");
  } catch (error) {
    console.error("Error updating order state:", error);
    return res.status(500).send("Internal Server Error");
  }
});

app.delete("/:sellerId/orders/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  try {
    // Find the order by ID and delete it
    const deletedOrder = await Order.findByIdAndDelete(orderId);

    // Remove the orderId from the corresponding user's orders array
    await userModel.updateOne(
      { _id: deletedOrder.userId },
      { $pull: { orders: orderId } }
    );

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/sellers/:sellerId/orders/:status", async (req, res) => {
  const status = req.params.status;
  const sellerId = req.params.sellerId;
  try {
    // Fetch the user (seller) by ID
    const seller = await userModel.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Fetch orders for the seller with the given status
    const orders = await Order.find({
      _id: { $in: seller.orders },
      state: status,
    }).sort("-createdAt");

    const totalOrders = orders.length;

    // Prepare response data
    const responseData = {
      orders: orders,
      totalOrders: totalOrders,
    };

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ message: `Server error: ${error}` });
  }
});

app.get("/product/filter/search", async (req, res) => {
  const keyword = req.query.keyword;
  const ProductIds = req.query.ProductIds; // Get filtered product IDs from the request query

  try {
    let searchQuery = {
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ],
    };
    if (ProductIds && ProductIds.length > 0) {
      searchQuery._id = { $in: ProductIds }; // Filter search within filtered products
    }
    const products = await productModel.find(searchQuery);
    res.json(products);
  } catch (error) {
    console.error("Error fetching search results:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/products/search/searched", async (req, res) => {
  const keyword = req.query.keyword;

  try {
    let searchQuery = {
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ],
    };
    const products = await productModel.find(searchQuery);
    res.json(products);
  } catch (error) {
    console.error("Error fetching search results:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/:sellerId/rate", async (req, res) => {
  const { sellerId, rating, userId } = req.body;

  try {
    const seller = await userModel.findById(sellerId);
    const rater = await userModel.findById(userId); // Fetch user who is rating

    if (!seller || !rater) {
      return res.status(404).json({ message: "User or seller not found" });
    }

    // Check for duplicate rating (optional)
    if (seller.ratings.some((r) => r.userId.toString() === userId)) {
      return res
        .status(400)
        .json({ message: "You have already rated this seller" });
    }

    seller.ratings.push({ userId, rating, timestamp: Date.now() });
    seller.averageRating = calculateAverageRating(seller.ratings); // Function to calculate average

    await seller.save();

    res.json({ message: "Rating submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// Function to calculate average rating (included in frontend example)
function calculateAverageRating(ratings) {
  if (ratings.length === 0) {
    return 0;
  }

  const totalRating = ratings.reduce((acc, rating) => acc + rating.rating, 0);
  const averageRating = totalRating / ratings.length;
  return averageRating;
}

app.get("/:sellerId/rating", async (req, res) => {
  const { sellerId } = req.params;
  try {
    const seller = await userModel
      .findById(sellerId)
      .select("averageRating ratings"); // Include both averageRating and ratings fields

    if (!seller) {
      return res.status(404).json({ message: "User not found" });
    }

    // Count the number of ratings directly from the retrieved ratings array
    const numberOfRatings = seller.ratings.length;

    res.json({ averageRating: seller.averageRating, numberOfRatings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/:productId/rates", async (req, res) => {
  const { productId, rating, userId } = req.body;

  try {
    const product = await productModel.findById(productId);
    const rater = await userModel.findById(userId); // Fetch user who is rating

    if (!product || !rater) {
      return res.status(404).json({ message: "User or product not found" });
    }

    // Check for duplicate rating (optional)
    if (product.ratings.some((r) => r.userId.toString() === userId)) {
      return res
        .status(400)
        .json({ message: "You have already rated this product" });
    }

    product.ratings.push({ userId, rating, timestamp: Date.now() });
    product.averageRating = calculateAverageRating(product.ratings); // Function to calculate average

    await product.save();

    res.json({ message: "Rating submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/:productId/ratings", async (req, res) => {
  const { productId } = req.params;
  try {
    const product = await productModel
      .findById(productId)
      .select("averageRating ratings"); // Include both averageRating and ratings fields

    if (!product) {
      return res.status(404).json({ message: "product not found" });
    }

    // Count the number of ratings directly from the retrieved ratings array
    const numberOfRatings = product.ratings.length;

    res.json({ averageRating: product.averageRating, numberOfRatings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/sellers/:sellerId/sellerProducts/:productId", async (req, res) => {
  const productId = req.params.productId;
  try {
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    await productModel.deleteOne({ _id: productId });
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  res.status(200).send("Hello, the server is up and running!");
});
