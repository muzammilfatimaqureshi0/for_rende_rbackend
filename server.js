// ================= IMPORTS =================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");

const TryOn = require("./models/TryOn");
const Post = require("./models/Post");
const Comment = require("./models/Comment");
const User = require("./models/User");
const Outfit = require("./models/Outfit");

const app = express();
app.use(express.json());
app.use(cors());
// ================= TRYON ROUTES CONFIG =================
const tryonRoutes = require("./routes/tryonRoutes");
app.use("/tryon", tryonRoutes);

// ================= RECOMMENDATION ROUTES  =================
const recommendationRoutes = require("./routes/recommendationRoutes");
app.use("/recommendations", recommendationRoutes);


// ================= SERVER CONFIG =================
const PORT = process.env.PORT || 5000;

// ✅ Only this line needs to change when your IP changes.
const BASE_IP_STRING = process.env.BASE_URL;
//|| "http://192.168.100.5:5000";  // Also update this IP everytime

// Helper: prepend BASE_IP_STRING to a relative /uploads/... path.
// If the value is already absolute (starts with http), return as-is.
function fullUrl(relativePath) {
  if (!relativePath) return "";
  if (relativePath.startsWith("http")) return relativePath;
  return `${BASE_IP_STRING}${relativePath}`;
}

// ================= MONGODB =================
const MONGO_URI = "mongodb://imtiasif1:pzpUMbcC62RQIRSx@ac-exhfwpp-shard-00-00.iamyzis.mongodb.net:27017,ac-exhfwpp-shard-00-01.iamyzis.mongodb.net:27017,ac-exhfwpp-shard-00-02.iamyzis.mongodb.net:27017/?ssl=true&replicaSet=atlas-121uts-shard-0&authSource=admin&appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch((err) => console.error("❌ MongoDB Atlas error:", err));

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });
app.use("/uploads", express.static("uploads"));

// Endpoint to upload a generated image from URL
app.post("/upload-generated", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: "No image URL provided" });

    // Fetch the image from the external URL
    const fetchResponse = await fetch(imageUrl);
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch image: ${fetchResponse.statusText}`);
    }

    const buffer = await fetchResponse.arrayBuffer();

    // Save locally
    const ext = ".webp"; // Gradio usually returns webp or we can try to guess from headers
    const filename = `generated_${Date.now()}${ext}`;
    const filepath = path.join(__dirname, "uploads", filename);

    const fs = require('fs');
    fs.writeFileSync(filepath, Buffer.from(buffer));

    const relativeUrl = `/uploads/${filename}`;
    res.json({ url: fullUrl(relativeUrl) });
  } catch (error) {
    console.error("Upload generated image error:", error);
    res.status(500).json({ message: "Failed to upload generated image" });
  }
});

/* =========================================================
   OUTFITS (CATEGORIES + LIST)
   NOTE: These endpoints are used by MenCategory + CategoryItems.
   ⚠️  Outfits already store and return full URLs — do not modify.
========================================================= */

// Get unique categories for a gender + a representative (oldest) image per category
app.get('/outfits/categories', async (req, res) => {
  try {
    const rawGender = String(req.query.gender || '').trim();
    if (!rawGender) return res.status(400).json({ message: 'gender is required' });

    // Accept case-insensitive input but match stored format
    const g = rawGender.toLowerCase();
    const gender = g === 'male' ? 'Male' : g === 'female' ? 'Female' : rawGender;

    // oldest saved outfit per category
    const categories = await Outfit.aggregate([
      { $match: { gender } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$category',
          category: { $first: '$category' },
          imageUrl: { $first: '$imageUrl' },
          image: { $first: '$image' },
          createdAt: { $first: '$createdAt' },
        },
      },
      { $sort: { category: 1 } },
    ]);

    res.json(
      categories.map((c) => ({
        category: c.category,
        image: c.imageUrl || c.image || '',
      }))
    );
  } catch (err) {
    console.error('Get outfit categories error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all outfits for a single gender + category
app.get('/outfits', async (req, res) => {
  try {
    const rawGender = String(req.query.gender || '').trim();
    const category = String(req.query.category || '').trim();

    if (!rawGender || !category) {
      return res.status(400).json({ message: 'gender and category are required' });
    }

    const g = rawGender.toLowerCase();
    const gender = g === 'male' ? 'Male' : g === 'female' ? 'Female' : rawGender;

    const outfits = await Outfit.find({ gender, category }).sort({ createdAt: 1 });

    // Normalize image field for the client (CategoryItems expects `image`)
    res.json(
      outfits.map((o) => {
        const doc = o.toObject();
        return {
          ...doc,
          image: doc.imageUrl || doc.image || '',
        };
      })
    );
  } catch (err) {
    console.error('Get outfits error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* =========================================================
   AUTH SECTION
========================================================= */

// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    const { username, firstName, lastName, email, password, gender } = req.body;

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      gender, // ✅ NEW FIELD SAVED
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "Invalid credentials" });

    // ✅ IMPORTANT FIX
    res.json({ user });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================
   PROFILE UPDATE (USERNAME, PASSWORD, IMAGE)
========================================================= */

app.put(
  "/update-profile/:id",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const { username, email, currentPassword, newPassword } = req.body;

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updateData = {};

      // ✅ username update
      if (username) {
        updateData.username = username;
      }

      // ✅ email update (with duplicate check)
      if (email && email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          return res.status(400).json({ message: "Email already in use" });
        }
        updateData.email = email;
      }

      // ✅ password update (verify current password first)
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password required" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }

        updateData.password = await bcrypt.hash(newPassword, 10);
      }

      // ✅ Store only relative path in DB
      if (req.file) {
        updateData.profileImage = `/uploads/${req.file.filename}`;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      // ✅ Return full URL to client
      const userToReturn = updatedUser.toObject();
      userToReturn.profileImage = fullUrl(userToReturn.profileImage);

      res.json(userToReturn);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Profile update failed" });
    }
  }
);

// GET USER
app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("followers", "username profileImage")
      .populate("following", "username profileImage");

    if (!user) return res.status(404).json({ message: "User not found" });

    const userObj = user.toObject();

    // ✅ Expand all profile image URLs before returning
    userObj.profileImage = fullUrl(userObj.profileImage);

    if (userObj.followers) {
      userObj.followers.forEach((f) => {
        f.profileImage = fullUrl(f.profileImage);
      });
    }

    if (userObj.following) {
      userObj.following.forEach((f) => {
        f.profileImage = fullUrl(f.profileImage);
      });
    }

    res.json(userObj);
  } catch {
    res.status(500).json({ message: "Error fetching user" });
  }
});

/* =========================================================
   POSTS SECTION
========================================================= */

// CREATE POST
app.post("/create-post", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "Image required" });

    // ✅ Store only relative path in DB
    const imageUrl = `/uploads/${req.file.filename}`;

    const newPost = await Post.create({
      user: req.body.userId,
      image: imageUrl,
      caption: req.body.caption,
    });

    const populatedPost = await newPost.populate(
      "user",
      "username profileImage followers following"
    );

    // ✅ Return full URLs to client
    const postObj = populatedPost.toObject();
    postObj.image = fullUrl(postObj.image);
    if (postObj.user) {
      postObj.user.profileImage = fullUrl(postObj.user.profileImage);
    }

    res.status(201).json(postObj);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// GET POSTS WITH COMMENT COUNT + COMMENTS
app.get("/get-posts", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Optional: filter by following IDs if provided
    const followingIds = req.query.followingIds
      ? req.query.followingIds.split(",").filter(Boolean)
      : null;

    const matchQuery = followingIds
      ? { user: { $in: followingIds.map((id) => new mongoose.Types.ObjectId(id)) } }
      : {};

    const totalPosts = await Post.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalPosts / limit) || 1;

    const posts = await Post.find(matchQuery)
      .populate("user", "username profileImage followers")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        const [commentCount, comments] = await Promise.all([
          Comment.countDocuments({ postId: post._id }),
          Comment.find({ postId: post._id })
            .populate("user", "username profileImage")
            .sort({ createdAt: 1 }),
        ]);

        const postObj = { ...post._doc, commentCount, comments };
        postObj.image = fullUrl(postObj.image);
        if (postObj.user) {
          postObj.user.profileImage = fullUrl(postObj.user.profileImage);
        }
        return postObj;
      })
    );

    res.json({ posts: postsWithCounts, totalPages, currentPage: page });
  } catch (error) {
    console.error("Error fetching posts", error);
    res.status(500).json({ message: "Error fetching posts" });
  }
});

// LIKE / UNLIKE
app.put("/like-post/:postId", async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.postId);

    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked)
      post.likes.pull(userId);
    else
      post.likes.push(userId);

    await post.save();

    res.json(post);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE POST
app.delete("/delete-post/:id", async (req, res) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);

    if (!deletedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ message: "Server error deleting post" });
  }
});

// EDIT POST
app.put("/edit-post/:id", async (req, res) => {
  try {
    const { caption } = req.body;

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { caption },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(updatedPost);
  } catch (error) {
    console.error("Edit post error:", error);
    res.status(500).json({ message: "Server error updating post" });
  }
});

/* =========================================================
   TRY-ON SAVE
========================================================= */

app.post("/upload-tryon", upload.fields([
  { name: "userImage", maxCount: 1 },
  { name: "outfitImage", maxCount: 1 },
]), async (req, res) => {
  try {
    const { userId, outfitUrl } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    if (!req.files || !req.files.userImage || !req.files.outfitImage)
      return res.status(400).json({ message: "Images are required" });

    const userImageFile = req.files.userImage[0];
    const outfitImageFile = req.files.outfitImage[0];

    // ✅ Store only relative paths in DB
    const newTryOn = await TryOn.create({
      user: userId,
      userImage: `/uploads/${userImageFile.filename}`,
      outfitImage: `/uploads/${outfitImageFile.filename}`,
      outfitUrl: typeof outfitUrl === "string" ? outfitUrl : "",
    });

    // ✅ Return full URLs to client
    const tryOnObj = newTryOn.toObject();
    tryOnObj.userImage = fullUrl(tryOnObj.userImage);
    tryOnObj.outfitImage = fullUrl(tryOnObj.outfitImage);

    res.status(201).json(tryOnObj);
  } catch (err) {
    console.error("TryOn save error:", err);
    res.status(500).json({ message: "Server error saving TryOn" });
  }
});

// GET USER PHOTOS from previous tryons
app.get("/get-user-photos/:userId", async (req, res) => {
  try {
    const tryons = await TryOn.find({
      user: req.params.userId,
    }).sort({ createdAt: -1 });

    // ✅ Return full URLs to client
    const photos = tryons.map((item) => fullUrl(item.userImage));

    res.json(photos);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user photos" });
  }
});

// GET USER OUTFITS from previous tryons
app.get("/get-user-outfits/:userId", async (req, res) => {
  try {
    const tryons = await TryOn.find({
      user: req.params.userId,
    }).sort({ createdAt: -1 });

    // ✅ Return full URLs to client
    const outfits = tryons.map((item) => fullUrl(item.outfitImage));

    res.json(outfits);
  } catch (error) {
    res.status(500).json({ message: "Error fetching outfits" });
  }
});

// DELETE SAVED OUTFIT
app.delete("/delete-tryon/:id", async (req, res) => {
  try {
    const deleted = await TryOn.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "TryOn not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Server error deleting outfit" });
  }
});

/* =========================================================
   FOLLOW SYSTEM
========================================================= */

app.put("/follow/:id", async (req, res) => {
  try {
    const { userId } = req.body;
    const followUserId = req.params.id;

    const user = await User.findById(userId);
    const targetUser = await User.findById(followUserId);

    const isFollowing = user.following.includes(followUserId);

    if (isFollowing) {
      user.following.pull(followUserId);
      targetUser.followers.pull(userId);
    } else {
      user.following.push(followUserId);
      targetUser.followers.push(userId);
    }

    await user.save();
    await targetUser.save();

    res.json({ message: "Follow updated" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   COMMENTS SECTION
========================================================= */

// CREATE COMMENT
app.post("/add-comment", async (req, res) => {
  try {
    const { postId, userId, text } = req.body;

    if (!postId || !userId || !text?.trim()) {
      return res.status(400).json({ message: "postId, userId and text are required" });
    }

    const comment = await Comment.create({
      postId,
      user: userId,
      text: text.trim(),
    });

    const populatedComment = await comment.populate(
      "user",
      "username profileImage"
    );

    res.status(201).json(populatedComment);
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE COMMENT (only owner)
app.delete("/delete-comment/:commentId", async (req, res) => {
  try {
    const { userId } = req.body;
    const { commentId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (String(comment.user) !== String(userId)) {
      return res.status(403).json({ message: "Not allowed to delete this comment" });
    }

    await Comment.deleteOne({ _id: commentId });

    res.json({ message: "Comment deleted", commentId, postId: comment.postId });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET COMMENTS BY POST
app.get("/get-comments/:postId", async (req, res) => {
  try {
    const comments = await Comment.find({
      postId: req.params.postId,
    })
      .populate("user", "username profileImage")
      .sort({ createdAt: 1 });

    res.json(comments);
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   STORE (BRANDS)
   ⚠️  Outfits already store and return full URLs — do not modify.
========================================================= */

// Get unique brands + a representative (oldest) image per brand
app.get('/outfits/brands', async (req, res) => {
  try {
    const brands = await Outfit.aggregate([
      { $match: { brand: { $exists: true, $ne: '' } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$brand',
          brand: { $first: '$brand' },
          imageUrl: { $first: '$imageUrl' },
          image: { $first: '$image' },
          createdAt: { $first: '$createdAt' },
        },
      },
      { $sort: { brand: 1 } },
    ]);

    res.json(
      brands.map((b) => ({
        brand: b.brand,
        image: b.imageUrl || b.image || '',
      }))
    );
  } catch (err) {
    console.error('Get outfit brands error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all outfits for a brand
app.get('/outfits/by-brand', async (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ message: 'brand is required' });

    const outfits = await Outfit.find({ brand }).sort({ createdAt: 1 });

    res.json(
      outfits.map((o) => {
        const doc = o.toObject();
        return {
          ...doc,
          image: doc.imageUrl || doc.image || '',
        };
      })
    );
  } catch (err) {
    console.error('Get outfits by brand error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET TRYONS
app.get("/get-tryons/:userId", async (req, res) => {
  try {
    const tryons = await TryOn.find({
      user: req.params.userId,
    }).sort({ createdAt: -1 });

    // ✅ Return full URLs to client
    res.json(
      tryons.map((t) => {
        const doc = t.toObject();
        doc.userImage = fullUrl(doc.userImage);
        doc.outfitImage = fullUrl(doc.outfitImage);
        return doc;
      })
    );
  } catch (error) {
    console.error("Get tryons error:", error);
    res.status(500).json({ message: "Error fetching tryons" });
  }
});

// GET /outfits/filter — supports gender, category, type, color, minPrice, maxPrice
app.get('/outfits/filter', async (req, res) => {
  try {
    const rawGender = String(req.query.gender || '').trim();
    if (!rawGender) return res.status(400).json({ message: 'gender is required' });

    const g = rawGender.toLowerCase();
    const gender = g === 'male' ? 'Male' : g === 'female' ? 'Female' : rawGender;

    const query = { gender };
    const category = String(req.query.category || '').trim();
    const type     = String(req.query.type     || '').trim();
    const color    = String(req.query.color    || '').trim();
    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || 30000;

    if (category) query.category = category;
    if (type)     query.type     = type;
    if (color)    query.color    = { $in: [color] };

    // Add price range filter
    query.price = { $gte: minPrice, $lte: maxPrice };

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const totalOutfits = await Outfit.countDocuments(query);
    const totalPages   = Math.ceil(totalOutfits / limit) || 1;

    const outfits = await Outfit.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    res.json({
      outfits: outfits.map((o) => {
        const doc = o.toObject();
        return { ...doc, image: doc.imageUrl || doc.image || '' };
      }),
      totalPages,
      currentPage: page,
      totalOutfits,
    });
  } catch (err) {
    console.error('Filter outfits error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /outfits/filter-options — returns distinct categories, types, colors for a gender
app.get('/outfits/filter-options', async (req, res) => {
  try {
    const rawGender = String(req.query.gender || '').trim();
    if (!rawGender) return res.status(400).json({ message: 'gender is required' });
    const g = rawGender.toLowerCase();
    const gender = g === 'male' ? 'Male' : g === 'female' ? 'Female' : rawGender;

    const [categories, types, colorsRaw] = await Promise.all([
      Outfit.distinct('category', { gender }),
      Outfit.distinct('type',     { gender }),
      Outfit.distinct('color',    { gender }),
    ]);

    // color is stored as array per document; distinct flattens one level but not arrays-within-arrays
    // Use aggregate to fully flatten
    const colorAgg = await Outfit.aggregate([
      { $match: { gender } },
      { $unwind: '$color' },
      { $group: { _id: '$color' } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      categories: categories.sort(),
      types:      types.sort(),
      colors:     colorAgg.map((c) => c._id),
    });
  } catch (err) {
    console.error('Filter options error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* =========================================================
   BRAND FILTER ROUTES
========================================================= */

// GET /brand-filter/options — distinct categories, types, colors for a brand (+ optional gender)
app.get('/brand-filter/options', async (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ message: 'brand is required' });

    const query = { brand };

    const rawGender = String(req.query.gender || '').trim();
    if (rawGender) {
      const g = rawGender.toLowerCase();
      query.gender = g === 'male' ? 'Male' : g === 'female' ? 'Female' : rawGender;
    }

    const [categories, types] = await Promise.all([
      Outfit.distinct('category', query),
      Outfit.distinct('type', query),
    ]);

    const colorAgg = await Outfit.aggregate([
      { $match: query },
      { $unwind: '$color' },
      { $group: { _id: '$color' } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      categories: categories.sort(),
      types: types.sort(),
      colors: colorAgg.map((c) => c._id),
    });
  } catch (err) {
    console.error('Brand filter options error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /brand-filter/outfits — outfits for a brand with optional gender/category/type/color/price
app.get('/brand-filter/outfits', async (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim();
    if (!brand) return res.status(400).json({ message: 'brand is required' });

    const query = { brand };

    const rawGender = String(req.query.gender || '').trim();
    if (rawGender) {
      const g = rawGender.toLowerCase();
      query.gender = g === 'male' ? 'Male' : g === 'female' ? 'Female' : rawGender;
    }

    const category = String(req.query.category || '').trim();
    const type     = String(req.query.type     || '').trim();
    const color    = String(req.query.color    || '').trim();
    const minPrice = parseInt(req.query.minPrice) || 0;
    const maxPrice = parseInt(req.query.maxPrice) || 30000;

    if (category) query.category = category;
    if (type)     query.type     = type;
    if (color)    query.color    = { $in: [color] };

    // Add price range filter
    query.price = { $gte: minPrice, $lte: maxPrice };

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const totalOutfits = await Outfit.countDocuments(query);
    const totalPages   = Math.ceil(totalOutfits / limit) || 1;

    const outfits = await Outfit.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    res.json({
      outfits: outfits.map((o) => {
        const doc = o.toObject();
        return { ...doc, image: doc.imageUrl || doc.image || '' };
      }),
      totalPages,
      currentPage: page,
      totalOutfits,
    });
  } catch (err) {
    console.error('Brand filter outfits error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`)
);