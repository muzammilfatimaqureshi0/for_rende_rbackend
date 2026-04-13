const Outfit = require("../models/Outfit");
const TryOn = require("../models/TryOn");
const TryEvent = require("../models/TryEvent");
const User = require("../models/User");

const normalizeImage = (outfitDoc) => {
  const doc = outfitDoc.toObject ? outfitDoc.toObject() : outfitDoc;
  return {
    ...doc,
    image: doc.imageUrl || doc.image || "",
  };
};

const scoreAgainstBase = (candidate, baseOutfit) => {
  let score = 0;
  const baseColors = Array.isArray(baseOutfit.color) ? baseOutfit.color : [];
  const candidateColors = Array.isArray(candidate.color) ? candidate.color : [];

  if (candidate.category === baseOutfit.category) score += 5;
  if (candidate.type === baseOutfit.type) score += 4;
  if (candidateColors.some((c) => baseColors.includes(c))) score += 3;

  return score;
};

exports.getRecommendations = async (req, res) => {
  try {
    const { outfitId } = req.params;
    const baseOutfit = await Outfit.findById(outfitId);

    if (!baseOutfit) {
      return res.status(404).json({ message: "Outfit not found" });
    }

    const candidates = await Outfit.find({
      gender: baseOutfit.gender,
      _id: { $ne: outfitId },
    });

    const ranked = candidates
      .map((item) => ({
        ...normalizeImage(item),
        score: scoreAgainstBase(item, baseOutfit),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.json(ranked);
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getRecommendationsForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const [user, recentTryOns, recentTryEvents] = await Promise.all([
      User.findById(userId).select("gender"),
      TryOn.find({
        user: userId,
        outfitUrl: { $exists: true, $ne: "" },
      })
        .sort({ createdAt: -1 })
        .limit(30),
      TryEvent.find({ user: userId }).sort({ createdAt: -1 }).limit(60),
    ]);

    const triedUrlsFromSave = recentTryOns.map((t) => t.outfitUrl).filter(Boolean);
    const triedUrlsFromEvents = recentTryEvents
      .map((e) => e.outfitUrl)
      .filter(Boolean);
    const triedUrls = [...new Set([...triedUrlsFromEvents, ...triedUrlsFromSave])];

    const historyOutfitsByUrl = triedUrls.length
      ? await Outfit.find({ url: { $in: triedUrls } })
      : [];
    const historyByUrlMap = new Map(historyOutfitsByUrl.map((o) => [o.url, o]));

    const eventHistory = recentTryEvents
      .map((e) => {
        const fromUrl = e.outfitUrl ? historyByUrlMap.get(e.outfitUrl) : null;
        return {
          type: e.type || fromUrl?.type || "",
          category: e.category || fromUrl?.category || "",
          color: Array.isArray(e.color) && e.color.length ? e.color : fromUrl?.color || [],
          gender: e.gender || fromUrl?.gender || user?.gender || "",
          outfitId: e.outfitId ? String(e.outfitId) : fromUrl?._id ? String(fromUrl._id) : "",
          outfitUrl: e.outfitUrl || fromUrl?.url || "",
        };
      })
      .filter((item) => item.type || item.category || (item.color && item.color.length));

    const saveHistory = recentTryOns
      .map((t) => historyByUrlMap.get(t.outfitUrl))
      .filter(Boolean)
      .map((o) => ({
        type: o.type || "",
        category: o.category || "",
        color: o.color || [],
        gender: o.gender || user?.gender || "",
        outfitId: String(o._id),
        outfitUrl: o.url || "",
      }));

    const history = [...eventHistory, ...saveHistory];

    // Fallback: if history is not available yet, return latest outfits by gender.
    if (!history.length) {
      const fallbackQuery = user?.gender ? { gender: user.gender } : {};
      const fallback = await Outfit.find(fallbackQuery).sort({ createdAt: -1 }).limit(12);
      return res.json(fallback.map(normalizeImage));
    }

    const latestBase = history[0];

    const typePref = {};
    const categoryPref = {};
    const colorPref = {};
    const triedIds = new Set(history.map((o) => o.outfitId).filter(Boolean));
    const triedUrlSet = new Set(history.map((o) => o.outfitUrl).filter(Boolean));

    for (const outfit of history) {
      if (outfit.type) typePref[outfit.type] = (typePref[outfit.type] || 0) + 1;
      if (outfit.category) {
        categoryPref[outfit.category] = (categoryPref[outfit.category] || 0) + 1;
      }
      for (const c of outfit.color || []) {
        colorPref[c] = (colorPref[c] || 0) + 1;
      }
    }

    const candidates = await Outfit.find({
      gender: latestBase.gender || user?.gender,
      _id: { $nin: [...triedIds] },
    }).limit(500);

    const ranked = candidates
      .map((candidate) => {
        const candidateColors = Array.isArray(candidate.color) ? candidate.color : [];
        const prefColorScore = candidateColors.reduce(
          (acc, c) => acc + (colorPref[c] || 0),
          0
        );

        const score =
          scoreAgainstBase(candidate, latestBase) +
          (typePref[candidate.type] || 0) * 2 +
          (categoryPref[candidate.category] || 0) * 2 +
          prefColorScore;

        return {
          ...normalizeImage(candidate),
          score,
        };
      })
      .filter((item) => !triedIds.has(String(item._id)) && !triedUrlSet.has(item.url))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    res.json(ranked);
  } catch (error) {
    console.error("User recommendation error:", error);
    res.status(500).json({ message: "Server error" });
  }
};