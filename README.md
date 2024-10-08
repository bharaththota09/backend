Food Delivery Backend

This project is a backend application for a food delivery platform built with Node.js, Express, MongoDB, and WebSocket. It manages user accounts, restaurants, menus, and orders while allowing real-time order status tracking with WebSockets. The project also includes JWT-based authentication for secure access to APIs.

1.Prerequisites
    To run this project, you’ll need:
        ->Node.js: ^14.0.0 or higher
        ->MongoDB: A running instance (local or cloud)
        ->npm: Node package manager
2.Installation
    Clone the repository:
        git clone https://github.com/bharaththota09/backend
        cd food-delivery-backend
    Install the necessary dependencies:
        npm install
    Environment Variables
        Create a .env file in the root directory and add the following variables:
            MONGODB_URI=mongodb://localhost:27017/myDatabase
            JWT_SECRET=your_jwt_secret
            PORT=5000
    To start the server:
        npm start
        This will start the application on http://localhost:5000 by default, and the WebSocket server will also be accessible on the same port.

API Endpoints
Authentication
Register: POST /register
Body: { "name": String, "email": String, "password": String }
Login: POST /login
Body: { "email": String, "password": String }
Response: { "token": String }
User Management
Get Profile: GET /profile
Headers: Authorization: Bearer <token>
Update Profile: PUT /profile
Headers: Authorization: Bearer <token>
Body: { "name": String, "email": String, "phone": String, "addresses": [String] }
Restaurant Management
Create Restaurant: POST /restaurants
Headers: Authorization: Bearer <token>
Body: { "name": String, "location": String }
Update Restaurant: PUT /restaurants/:restaurantId
Headers: Authorization: Bearer <token>
Body: { "name": String, "location": String }
Add Menu Items: POST /restaurants/:restaurantId/menu
Headers: Authorization: Bearer <token>
Body: [{ "name": String, "description": String, "price": Number, "available": Boolean }]
Update Menu Item: PUT /restaurants/:restaurantId/menu/:itemId
Headers: Authorization: Bearer <token>
Body: { "name": String, "description": String, "price": Number, "available": Boolean }
Order Management
Place Order: POST /orders
Headers: Authorization: Bearer <token>
Body: { "restaurantId": String, "items": [{ "name": String, "quantity": Number }], "deliveryAddress": String }
Get Order: GET /orders/:orderId
Headers: Authorization: Bearer <token>
Update Order Status: PUT /orders/:orderId/status
Headers: Authorization: Bearer <token>
Body: { "status": String }
Track Order: GET /orders/:orderId/track
Headers: Authorization: Bearer <token>
Get All Orders: GET /orders
Headers: Authorization: Bearer <token>
WebSocket Functionality
The WebSocket server listens for connections to provide real-time updates on order status:

Upon connection, the client can send its userId to register with the WebSocket.
When an order status is updated via PUT /orders/:orderId/status, the server checks for an active WebSocket connection for the order's user and sends a real-time update if connected.
Error Handling
The application uses standard HTTP status codes for responses:

400 - Bad Request: Invalid input or request data
401 - Unauthorized: Authentication failure
404 - Not Found: Resource not found
500 - Internal Server Error: Unexpected errors