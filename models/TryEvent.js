const mongoose = require("mongoose");

const tryEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    outfitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outfit",
      required: false,
      index: true,
    },
    outfitUrl: {
      type: String,
      default: "",
      index: true,
    },
    type: {
      type: String,
      default: "",
      index: true,
    },
    category: {
      type: String,
      default: "",
      index: true,
    },
    gender: {
      type: String,
      default: "",
      index: true,
    },
    color: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

tryEventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("TryEvent", tryEventSchema);
