// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
			unique: true, // Ensures that email is unique
			trim: true, // Trims whitespace
			lowercase: true, // Ensures email is stored in lowercase
		},
		password: {
			type: String,
			required: true,
		},
		image: {
			type: String,
			// required: true,
		},
		friendRequests: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User', // Reference to the User model
			},
		],
		friends: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User', // Reference to the User model
			},
		],
		sentFriendRequests: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User', // Reference to the User model
			},
		],
	},
	{
		timestamps: true, // Automatically create createdAt and updatedAt fields
	}
);

// Create a User model
const User = mongoose.model('User', userSchema);

module.exports = User;
