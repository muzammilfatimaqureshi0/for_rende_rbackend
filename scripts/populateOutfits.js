const mongoose = require("mongoose");

const MONGO_URI = "mongodb://imtiasif1:pzpUMbcC62RQIRSx@ac-exhfwpp-shard-00-00.iamyzis.mongodb.net:27017,ac-exhfwpp-shard-00-01.iamyzis.mongodb.net:27017,ac-exhfwpp-shard-00-02.iamyzis.mongodb.net:27017/?ssl=true&replicaSet=atlas-121uts-shard-0&authSource=admin&appName=Cluster0";

// ================= SCHEMA =================
const outfitSchema = new mongoose.Schema({
  type: { type: String, required: true },
  category: { type: String, required: true },
  gender: { type: String, required: true },
  color: { type: [String], required: true },
  url: { type: String, required: true },
  imageUrl: { type: String, required: true },
  brand: { type: String, required: true },
}, { timestamps: true });

// CATEGORY FLOW
outfitSchema.index({gender: 1,category: 1,type: 1,color: 1,brand: 1});
// BRAND FLOW
outfitSchema.index({brand: 1,gender: 1, type: 1, color: 1});

const Outfit = mongoose.model("Outfit", outfitSchema);

// ================= DATA =================
const outfits = [
  {
    type: "Kurta",
    category: "Casual",
    gender: "Female",
    color: ["Blue"],
    url: "https://www.junaidjamshed.com/blue-dobby-embroidered-kurti-jss26606s.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/j/s/jss-26-606_6_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Kurta",
    category: "Casual",
    gender: "Female",
    color: ["Beige"],
    url: "https://www.junaidjamshed.com/beige-lawn-embroidered-kurti-jss26602s.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/j/s/jss-26-602_1_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Frock",
    category: "Festive",
    gender: "Female",
    color: ["Black"],
    url: "https://www.junaidjamshed.com/black-dobby-embroidered-stitched-3pc-jls26490s.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/2/6/26-490s_1_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Shalwar Kameez",
    category: "Formal",
    gender: "Female",
    color: ["Pink"],
    url: "https://www.junaidjamshed.com/pink-cotton-silk-embroidered-stitched-3pc-jls26553s.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/2/6/26-553s_5_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Abaya",
    category: "Modest",
    gender: "Female",
    url: "https://www.junaidjamshed.com/maroon-crepe-abaya-jjab-22-025.html",
    color: ["Maroon"],
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/j/j/jjab-22-025_1_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Saree",
    category: "Formal",
    gender: "Female",
    color: ["Maroon"],
    url: "https://www.junaidjamshed.com/multicolor-viscose-yarn-dyed-saree-jsr-w-24-510.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/j/s/jsr-24-510_1_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Abaya",
    category: "Modest",
    gender: "Female",
    color: ["Brown"],
    url: "https://zellbury.com/products/abaya-wmw25037",
    imageUrl: "https://zellbury.com/cdn/shop/files/WMW25037_1.jpg?v=1772604259&width=990",
    brand: "Zellbury"
  },
  {
    type: "Frock",
    category: "Casual",
    gender: "Female",
    color: ["Pink"],
    url: "https://zellbury.com/products/tunics-wws251392",
    imageUrl: "https://zellbury.com/cdn/shop/files/WWS251392_5.jpg?v=1762177033&width=990",
    brand: "Zellbury"
  },
  {
    type: "Shalwar Kameez",
    category: "Formal",
    gender: "Female",
    color: ["Red"],
    url: "https://bonanzasatrangi.com/products/wp3psfw25f11d1",
    imageUrl: "https://bonanzasatrangi.com/cdn/shop/files/WP3PSFW25F11D1.jpg",
    brand: "Bonanza Satrangi"
  },
  {
    type: "Shalwar Kameez",
    category: "Formal",
    gender: "Female",
    color: ["Blue"],
    url: "https://bonanzasatrangi.com/products/wus25de3029",
    imageUrl: "https://bonanzasatrangi.com/cdn/shop/files/WUS25DE3029_3.jpg",
    brand: "Bonanza Satrangi"
  },
  {
    type: "Shalwar Kameez",
    category: "Casual",
    gender: "Male",
    color: ["Brown"],
    url: "https://www.junaidjamshed.com/brown-casual-kameez-shalwar-jjksa33809.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/j/j/jjks-33809_2_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Saree",
    category: "Formal",
    gender: "Female",
    color: ["Pink"],
    url: "https://omalbykomal.com/products/maha-saree",
    imageUrl: "https://omalbykomal.com/cdn/shop/files/NRW01327.jpg",
    brand: "Omal by Komal"
  },
  {
    type: "Kurta Trouser",
    category: "Casual",
    gender: "Male",
    color: ["Blue"],
    url: "https://www.junaidjamshed.com/blue-casual-kurta-trouser-jjkpa33885.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/3/3/33885jjkp-11_1_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Shalwar Kameez",
    category: "Casual",
    gender: "Male",
    color: ["Brown"],
    url: "https://zellbury.com/products/jade-shalwar-kameez-mskj2502605",
    imageUrl: "https://zellbury.com/cdn/shop/files/MSKJ2502605_7.jpg",
    brand: "Zellbury"
  },
  {
    type: "Kurta Trouser",
    category: "Casual",
    gender: "Male",
    style: "short",
    color: ["Blue"],
    url: "https://www.junaidjamshed.com/teal-blue-casual-short-kurta-trousers-jjshkpa47708.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/4/7/47708jjshkp_3_.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Waistcoat",
    category: "Formal",
    gender: "Male",
    color: ["Blue"],
    url: "https://diners.com.pk/products/egw0020-sky-blue",
    imageUrl: "https://diners.com.pk/cdn/shop/files/EGW0020-Sky-01_1200x.webp",
    brand: "Diners"
  },
  {
    type: "Waistcoat",
    category: "Formal",
    gender: "Male",
    color: ["Blue"],
    url: "https://diners.com.pk/products/egw0034-d-blue",
    imageUrl: "https://diners.com.pk/cdn/shop/files/EGW-0034-D-BLUE-01_1200x.webp",
    brand: "Diners"
  },
  {
    type: "Kurta",
    category: "Formal",
    gender: "Male",
    color: ["Black"],
    url: "https://diners.com.pk/products/etks0034-n-blue",
    imageUrl: "https://diners.com.pk/cdn/shop/files/ETKS0034-N-BLUE-02_1200x.webp",
    brand: "Diners"
  },
  {
    type: "Kurta",
    category: "Casual",
    gender: "Male",
    color: ["Black"],
    url: "https://www.junaidjamshed.com/black-plain-kameez-shalwar-jjksa30778r47ap.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/3/0/30778_1__1_10.jpg",
    brand: "Junaid Jamshed"
  },
  {
    type: "Shalwar Kameez",
    category: "Formal",
    gender: "Male",
    color: ["White"],
    hasWaistcoat: true,
    url: "https://www.junaidjamshed.com/off-white-exclusive-kameez-shalwar-waistcoat-jjksvca48338.html",
    imageUrl: "https://www.junaidjamshed.com/media/catalog/product/j/j/jjks-48286-sig_8_-_copy_-_copy_3.jpg?width=436&height=560&canvas=436,560&optimize=medium&bg-color=255,255,255&fit=bounds",
    brand: "Junaid Jamshed"
  },
  {
    type: "Waistcoat",
    category: "Formal",
    gender: "Male",
    color: ["White","Brown"],
    url: "https://zellbury.com/products/waist-coat-mwc25105",
    imageUrl: "https://zellbury.com/cdn/shop/files/MWC25105_11.jpg",
    brand: "Zellbury"
  },
  {
    type: "Blazer",
    category: "Formal",
    gender: "Male",
    color: ["Black","Beige"],
    url: "https://zellbury.com/products/blazer-mcbc2505",
    imageUrl: "https://zellbury.com/cdn/shop/files/MCBC2505_BLUE_4.jpg",
    brand: "Zellbury"
  }
];

// ================= SEED FUNCTION =================
async function seedDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    await Outfit.deleteMany(); // optional reset
    await Outfit.insertMany(outfits);

    console.log("Outfits seeded successfully");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedDB();