// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
	senderId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User', // Reference to the User model
	},
	recipientId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User', // Reference to the User model
	},
	messageType: {
		type: String,
		enum: ['text', 'image'], // Allowed values
	},
	message: String,
	imageUrl: String,
	timestamp: {
		type: Date,
		default: Date.now, // Sets the default value to the current date
	},
});

// Create a Message model
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
