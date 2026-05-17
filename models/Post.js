const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      trim: true,
      default: "",
    },
    outfit: {  // ✅ ADD THIS - stores entire outfit reference
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Outfit",
      },
      url: String,
      name: String,
      brand: String,
      price: Number,
      image: String,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("Post", postSchema);