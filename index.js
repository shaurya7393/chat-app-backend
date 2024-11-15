// index.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const cors = require('cors');
const bcrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;
const multer = require('multer');
const jwt = require('jsonwebtoken');
const User = require('./models/User'); // Assume you have a User model in models/User.js
const Message = require('./models/messgeScema'); // Assume you have a User model in models/User.js
const app = express();
const http = require('http');
const server = http.createServer(app); // Make sure the server is initialized first
const { Server } = require('socket.io');

const socketIO = new Server(server, {
  cors: {
    origin: '*', // or specify the exact origin, e.g., 'http://localhost:3000' for React app
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

const PORT = 8000;
const MONGODB_URI =
	'mongodb+srv://ayushgupta78686:1234@cluster0.qopbp.mongodb.net/'; // Replace with your MongoDB URI
const JWT_SECRET = 'h3#n8V@9zU8$y1&Q5xR8z!rW7mL4^hT3';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(passport.initialize());

// Mongoose connection
mongoose
	.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
	.then(() => console.log('MongoDB connected'))
	.catch((err) => console.error('MongoDB connection error:', err));

const createToken = (userId) => {
	// set the token payload
	const payload = {
		userId: userId,
	};
	//Generate token with secret key
	const token = jwt.sign(payload, JWT_SECRET, {
		expiresIn: '1h',
	});
	return token;
};

//Add this before the app.get() block
socketIO.on('connection', (socket) => {
	console.log(`⚡: ${socket.id} user just connected!`);
	socket.on('disconnect', () => {
		console.log('🔥: A user disconnected');
	});
});

// Start the server
server.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

// Set up storage engine for multer
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'uploads/'); // Directory to save uploaded files
	},
	filename: (req, file, cb) => {
		cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to filename
	},
});

// Initialize upload variable
const upload = multer({ storage: storage });

// Image upload route
app.post('/upload-image', upload.single('image'), async (req, res) => {
	try {
		// Check if a file is uploaded
		if (!req.file) {
			return res.status(400).json({ message: 'No file uploaded.' });
		}

		// Get the path of the uploaded image
		const imageUrl = req.file.path;

		// Respond with the image URL (this can be used for storing the image path in the database or sending it to the front end)
		res.status(200).json({
			message: 'Image uploaded successfully.',
			imageUrl: imageUrl, // Send the path or URL to the client
		});
	} catch (error) {
		console.error('Error uploading image:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

app.post('/register', async (req, res) => {
	const { name, email, password } = req.body;
	console.log(req.body);

	try {
		// Check if the user already exists
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ message: 'Email already in use.' });
		}

		// Hash the password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create a new user
		const newUser = new User({
			name,
			email,
			password: hashedPassword,
			// image,
		});

		// Save the user to the database
		await newUser.save();
		res
			.status(201)
			.json({ message: 'User registered successfully!', userId: newUser._id });
	} catch (error) {
		console.error('Error registering user:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Login route
app.post('/login', async (req, res) => {
	const { email, password } = req.body;

	try {
		// Find the user by email
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({ message: 'Invalid email or password.' });
		}

		// Compare the password with the  password
		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(400).json({ message: 'Invalid email or password.' });
		}

		// Generate JWT token
		const token = createToken(user._id);
		res.json({ message: 'Login successful!', token });
	} catch (error) {
		console.error('Error logging in:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Get all users except the logged-in user
app.get('/users/:userId', async (req, res) => {
	const { userId } = req.params;
	try {
		// Find all users except the one with userId
		const loggedInUser = await User.findById(userId);
		if (!loggedInUser) {
			return res.status(404).json({ message: 'User not found.' });
		}

		const users = await User.find({
			_id: {
				$ne: userId,
				$nin: loggedInUser.friends,
				$nin: loggedInUser.friendRequests,
			},
		});
		res.json(users);
	} catch (error) {
		console.error('Error fetching users:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Send friend request and update both arrays
app.post('/friend-request', async (req, res) => {
	const { senderId, recipientId } = req.body;

	try {
		// Find the sender and recipient users
		const sender = await User.findById(senderId);
		const recipient = await User.findById(recipientId);

		if (!sender || !recipient) {
			return res.status(404).json({ message: 'User not found.' });
		}

		// Push recipient ID to sender's friendRequests array
		sender.sentFriendRequests.push(recipientId);
		await sender.save();

		// Optionally, you might want to add the sender to the recipient's pending requests as well
		recipient.friendRequests.push(senderId);
		await recipient.save();

		res.status(200).json({ message: 'Friend request sent successfully.' });
	} catch (error) {
		console.error('Error sending friend request:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Get friend requests for a user
app.get('/friend-requests/:userId', async (req, res) => {
	const { userId } = req.params;

	try {
		const user = await User.findById(userId)
			.populate('friendRequests', '_id name email image')
			.lean(); // Populate with user details

		if (!user) {
			return res.status(404).json({ message: 'User not found.' });
		}

		res.status(200).json(user.friendRequests); // Return friend requests
	} catch (error) {
		console.error('Error fetching friend requests:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Accept or deny friend request
app.post('/friend-request/:userId', async (req, res) => {
	const { userId: senderId } = req.params;
	const { recipientId, action } = req.body; // action can be "accept" or "deny"

	try {
		const requestSender = await User.findById(senderId);
		// if (!requestSender) {
		// 	return res.status(404).json({ message: 'User not found.' });
		// }

		const requestReceiver = await User.findById(recipientId);
		// Check if the requester is in the friend's request list
		// if (!requestReceiver.friendRequests.includes(senderId)) {
		// 	return res
		// 		.status(400)
		// 		.json({ message: 'No friend request from this user.' });
		// }

		if (action === 'accept') {
			// Add requesterId to the user's friends list
			requestSender.friends.push(recipientId);
			await requestSender.save();

			requestReceiver.friends.push(senderId);
			await requestReceiver.save();

			// Remove the requesterId from the friend's requests
			requestReceiver.friendRequests = requestReceiver.friendRequests.filter(
				(id) => id.toString() !== senderId
			);
			await requestReceiver.save();

			// Remove the senderId from the sender's sent requests
			requestSender.sentFriendRequests =
				requestSender.sentFriendRequests.filter((id) => {
					return id.toString() !== recipientId;
				});

			await requestSender.save();

			res
				.status(200)
				.json({ message: 'Friend request accepted successfully.' });
		} else if (action === 'deny') {
			// Remove the requesterId from the friend's requests
			requestReceiver.friendRequests = requestReceiver.friendRequests.filter(
				(id) => id.toString() !== senderId
			);
			await requestReceiver.save();

			// Remove the senderId from the sender's sent requests
			requestSender.sentFriendRequests =
				requestSender.sentFriendRequests.filter((id) => {
					return id.toString() !== recipientId;
				});

			await requestSender.save();

			res.status(200).json({ message: 'Friend request denied successfully.' });
		} else {
			return res
				.status(400)
				.json({ message: 'Invalid action. Must be "accept" or "deny".' });
		}
	} catch (error) {
		console.error('Error processing friend request:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Get all friends of a user
app.get('/friends/:userId', async (req, res) => {
	const { userId } = req.params;

	try {
		// Find the user by their ID and populate their friends
		const user = await User.findById(userId)
			.populate('friends', '_id name email image')
			.lean();

		if (!user) {
			return res.status(404).json({ message: 'User not found.' });
		}

		// Return the list of friends
		res.status(200).json(user.friends);
	} catch (error) {
		console.error('Error fetching friends:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Get user details by user ID
app.get('/user/:userId', async (req, res) => {
	const { userId } = req.params;

	try {
		// Fetch the user from the database
		const user = await User.findById(userId).select('-password'); // Exclude password for security
		if (!user) {
			return res.status(404).json({ message: 'User not found.' });
		}

		res.status(200).json(user);
	} catch (error) {
		console.error('Error fetching user details:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// Get messages between two users
app.get('/messages/:userId1/:userId2', async (req, res) => {
	const { userId1, userId2 } = req.params;

	try {
		// Fetch messages between the two users
		const messages = await Message.find({
			$or: [
				{ senderId: userId1, recipientId: userId2 },
				{ senderId: userId2, recipientId: userId1 },
			],
		}).sort({ timestamp: 1 }); // Sort by timestamp

		res.status(200).json(messages);
	} catch (error) {
		console.error('Error fetching messages:', error);
		res.status(500).json({ message: 'Internal server error.' });
	}
});

// // Socket.io connection handling
const userSockets = {}; // Track users and their socket ids

socketIO.on('connection', (socket) => {
	console.log('a user connected: ', socket.id);

	// Store socket id when a user connects
	socket.on('registerSocket', (userId) => {
		userSockets[userId] = socket.id;
		console.log(`User ${userId} connected with socket ID: ${socket.id}`);
	});

	// When a user sends a message, broadcast it to the recipient
	socket.on('sendMessage', async (data) => {
		const { senderId, recipientId, message, messageType, imageUrl } = data;
		console.log(data);

		if (!senderId || !recipientId || !message) {
			console.error('Missing required fields in message data', data);
			return;
		}

		try {
			// Create and save the new message to the database
			const newMessage = new Message({
				senderId,
				recipientId,
				message,
				messageType,
				timestamp: Date.now(),
				imageUrl: imageUrl || null,
			});
			await newMessage.save();

			// Emit the message to the recipient using their socket ID
			const recipientSocketId = userSockets[recipientId];
			if (recipientSocketId) {
				socketIO.to(recipientSocketId).emit('receiveMessage', newMessage);
				console.log('Message sent:', newMessage);
			} else {
				console.log('Recipient is not connected');
			}
		} catch (error) {
			console.error('Error saving message:', error);
		}
	});

	// Handle disconnection and remove user from the socket mapping
	socket.on('disconnect', () => {
		// Remove user from userSockets when disconnected
		for (const [userId, socketId] of Object.entries(userSockets)) {
			if (socketId === socket.id) {
				delete userSockets[userId];
				console.log(`User ${userId} disconnected`);
				break;
			}
		}
	});
});
