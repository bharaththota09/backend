const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const http = require("http");
const WebSocket = require("ws");

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/myDatabase")
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    addresses: [{ type: String }],
  },
  { timestamps: true }
);

// Restaurant Schema
const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    menu: [
      {
        name: { type: String, required: true },
        description: { type: String },
        price: { type: Number, required: true },
        available: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
      },
    ],
    deliveryAddress: { type: String, required: true },
    totalCost: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "In Progress",
        "Out for Delivery",
        "Delivered",
      ],
      default: "Pending",
    },
    estimatedDeliveryTime: { type: Date },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
const User = mongoose.model("User", userSchema);
const Restaurant = mongoose.model("Restaurant", restaurantSchema);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();
wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const { userId } = JSON.parse(message);
    clients.set(userId, ws);
  });

  ws.on("close", () => {
    for (let [userId, client] of clients) {
      if (client === ws) {
        clients.delete(userId);
        break;
      }
    }
  });
});

// verifying user
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization").replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || "bharath");
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token" });
  }
};

// Routes
//Register user
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

//Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "bharath",
      { expiresIn: "1h" }
    );
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

//Get user info

app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

//update user details

app.put("/profile", authMiddleware, async (req, res) => {
  const { name, email, phone, addresses } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, phone, addresses },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Create a new restaurant

app.post("/restaurants", authMiddleware, async (req, res) => {
  const { name, location } = req.body;

  try {
    const newRestaurant = new Restaurant({ name, location });
    await newRestaurant.save();
    res.status(201).json(newRestaurant);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Update restaurant details

app.put("/restaurants/:restaurantId", authMiddleware, async (req, res) => {
  const { restaurantId } = req.params;
  const { name, location } = req.body;

  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { name, location },
      { new: true }
    );
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Add items to a restaurant’s menu
app.post(
  "/restaurants/:restaurantId/menu",
  authMiddleware,
  async (req, res) => {
    const { restaurantId } = req.params;
    const { menu } = req.body;
    try {
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ message: "Restaurant not found" });

      menu.forEach((item) => {
        restaurant.menu.push(item);
      });

      await restaurant.save();
      res.status(201).json(restaurant);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Update a specific menu item
app.put(
  "/restaurants/:restaurantId/menu/:itemId",
  authMiddleware,
  async (req, res) => {
    const { restaurantId, itemId } = req.params;
    const { name, description, price, available } = req.body;

    try {
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ message: "Restaurant not found" });

      const menuItem = restaurant.menu.id(itemId);
      if (!menuItem)
        return res.status(404).json({ message: "Menu item not found" });

      menuItem.name = name || menuItem.name;
      menuItem.description = description || menuItem.description;
      menuItem.price = price || menuItem.price;
      menuItem.available =
        available !== undefined ? available : menuItem.available;

      await restaurant.save();
      res.json(restaurant);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Place a new order
app.post("/orders", authMiddleware, async (req, res) => {
  const { restaurantId, items, deliveryAddress } = req.body;

  try {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });
    let totalCost = 0;
    const validatedItems = [];
    for (const item of items) {
      const menuItem = restaurant.menu.find(
        (menuItem) => menuItem.name === item.name
      );
      if (!menuItem) {
        return res
          .status(400)
          .json({
            message: `Item '${item.name}' not found in restaurant's menu.`,
          });
      }
      const itemTotalPrice = menuItem.price * item.quantity;
      totalCost += itemTotalPrice;
      validatedItems.push({
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price,
      });
    }

    // Create a new order
    const estimatedDeliveryTime = new Date();
    estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 30);
    const newOrder = new Order({
      userId: req.user.id,
      restaurantId,
      items: validatedItems,
      deliveryAddress,
      totalCost,
      estimatedDeliveryTime,
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

//get order details by id

app.get("/orders/:orderId", authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await Order.findById(orderId)
      .populate("restaurantId", "name location")
      .populate("userId", "name email");
    if (!order) return res.status(404).json({ message: "Order not found" });
    const orderDetails = {
      _id: order._id,
      user: {
        name: order.userId.name,
        email: order.userId.email,
      },
      restaurant: {
        name: order.restaurantId.name,
        location: order.restaurantId.location,
      },
      items: order.items,
      deliveryAddress: order.deliveryAddress,
      totalCost: order.totalCost,
      status: order.status,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
    res.json(orderDetails);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//update order status

app.put("/orders/:orderId/status", authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  try {
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    const clientWs = clients.get(order.userId.toString());
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          orderId,
          status,
          estimatedDeliveryTime: order.estimatedDeliveryTime,
        })
      );
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

//get all orders of user

app.get("/orders", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("restaurantId", "name location")
      .select(
        "items deliveryAddress totalCost status estimatedDeliveryTime createdAt updatedAt"
      );
    const simplifiedOrders = orders.map((order) => ({
      _id: order._id,
      restaurant: {
        name: order.restaurantId.name,
        location: order.restaurantId.location,
      },
      items: order.items,
      deliveryAddress: order.deliveryAddress,
      totalCost: order.totalCost,
      status: order.status,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    res.json(simplifiedOrders);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Track order status
app.get("/orders/:orderId/track", authMiddleware, async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId)
      .populate("restaurantId", "name location")
      .select("status estimatedDeliveryTime");

    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({
      status: order.status,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      restaurant: order.restaurantId,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
