const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/funfood_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  image: { type: String },
  category: { type: String },
  inStock: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  orders: [{
    orderId: String,
    products: [{
      productId: String,
      name: String,
      price: Number,
      quantity: Number
    }],
    total: Number,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  cart: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number,
    addedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// API Routes

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ inStock: true });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search products
app.get('/api/products/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const products = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } }
      ],
      inStock: true
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// User registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }
    
    const user = new User({ name, email, phone, address });
    await user.save();
    
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user profile
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add to cart
app.post('/api/users/:id/cart', async (req, res) => {
  try {
    const { productId, name, price, quantity } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const existingItem = user.cart.find(item => item.productId === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      user.cart.push({ productId, name, price, quantity });
    }
    
    await user.save();
    res.json({ success: true, data: user.cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cart
app.get('/api/users/:id/cart', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user.cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place order
app.post('/api/users/:id/orders', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const orderId = 'ORDER_' + Date.now();
    const total = user.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const order = {
      orderId,
      products: user.cart.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      total,
      status: 'pending'
    };
    
    user.orders.push(order);
    user.cart = []; // Clear cart after order
    await user.save();
    
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user orders
app.get('/api/users/:id/orders', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user.orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } 
});

// Get shop data from main database (dynamic data fetching)
app.get('/api/shop-data', async (req, res) => {
  try {
    const http = require('http');
    const mainServerUrl = process.env.MAIN_SERVER_URL || 'http://localhost:3001';
    const adminId = '6902176a312bc81a247cf58e';
    
    // Make request to main server to get shop data
    const options = {
      hostname: mainServerUrl.replace('http://', '').replace('https://', ''),
      port: 3001,
      path: `/shop-data/${adminId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const request = http.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const shopData = JSON.parse(data);
          if (shopData.success) {
            // Store products in local database
            const products = shopData.data.products || [];
            
            // Clear existing products and insert new ones
            Product.deleteMany({}).then(() => {
              const productPromises = products.map(product => {
                const newProduct = new Product({
                  name: product.name || product.productName,
                  price: parseFloat(product.price) || 0,
                  description: product.description || '',
                  image: product.image,
                  category: product.category || 'General',
                  inStock: true
                });
                return newProduct.save();
              });
              
              Promise.all(productPromises).then(() => {
                res.json({
                  success: true,
                  data: {
                    shopName: shopData.data.shopName,
                    appName: shopData.data.appName,
                    gstNumber: shopData.data.gstNumber,
                    products: products,
                    lastUpdated: shopData.data.lastUpdated
                  }
                });
              }).catch(err => {
                console.error('Error saving products:', err);
                res.json({ success: true, data: shopData.data });
              });
            });
          } else {
            res.status(404).json({ success: false, error: 'Shop data not found' });
          }
        } catch (parseError) {
          console.error('Error parsing shop data:', parseError);
          res.status(500).json({ success: false, error: 'Failed to parse shop data' });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Error fetching shop data:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch shop data from main server' });
    });
    
    request.end();
    
  } catch (error) {
    console.error('Error in shop-data endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real-time configuration endpoint for mobile app updates
app.get('/api/app-config', async (req, res) => {
  try {
    // This would connect to your main database to get latest configuration
    const config = {
      adminId: '6902176a312bc81a247cf58e',
      shopName: 'FunFood',
      lastUpdated: new Date().toISOString(),
      // Add dynamic configuration based on your app structure
      features: {
        searchEnabled: true,
        cartEnabled: true,
        userRegistrationEnabled: true,
        orderTrackingEnabled: true
      }
    };
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FunFood Backend Server running on port ${PORT}`);
});

module.exports = app;
