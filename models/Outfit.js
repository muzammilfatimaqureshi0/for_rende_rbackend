const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Product / shop fields (used later for Buy + shop by brand)
    url: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    color: {
     type: [String],
     required: true,
     index: true,
    },

    // Support both keys to match existing DB/seeding scripts.
    // Prefer `imageUrl` going forward, but keep `image` for backward compatibility.
    imageUrl: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      required: false,
    },

    // optional owner if you later want per-user closets
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Helpful compound index for gender/category queries
// CATEGORY FLOW
outfitSchema.index({gender: 1,category: 1,type: 1,color: 1,brand: 1});

// BRAND FLOW
outfitSchema.index({brand: 1,gender: 1,type: 1,color: 1,category: 1});

module.exports = mongoose.model('Outfit', outfitSchema);
