// This route handles the virtual try-on process.
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { runTryOn } = require("../services/tryonService");
const TryEvent = require("../models/TryEvent");

const router = express.Router();

const BASE_URL = process.env.BASE_URL;
//|| "http://192.168.100.5:5000";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

router.post(
  "/",
  upload.fields([
    { name: "personImage", maxCount: 1 },
    { name: "clothImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!req.files?.personImage || !req.files?.clothImage) {
        return res.status(400).json({ message: "Images required" });
      }

      const personPath = req.files.personImage[0].path;
      const clothPath = req.files.clothImage[0].path;

      const { relativePath } = await runTryOn(personPath, clothPath);

      // Track "try" events even when user does not save.
      const userId = req.body?.userId;
      const outfitMetaRaw = req.body?.outfitMeta;
      if (userId) {
        try {
          let parsedMeta = {};
          if (typeof outfitMetaRaw === "string" && outfitMetaRaw.trim()) {
            parsedMeta = JSON.parse(outfitMetaRaw);
          }

          const colors = Array.isArray(parsedMeta?.color)
            ? parsedMeta.color.filter(Boolean)
            : parsedMeta?.color
            ? [String(parsedMeta.color)]
            : [];

          await TryEvent.create({
            user: userId,
            outfitId: parsedMeta?._id || undefined,
            outfitUrl: parsedMeta?.url || "",
            type: parsedMeta?.type || "",
            category: parsedMeta?.category || "",
            gender: parsedMeta?.gender || "",
            color: colors,
          });
        } catch (trackErr) {
          console.error("Try event tracking error:", trackErr?.message || trackErr);
        }
      }

      // Convert the relative /uploads/... path to a full absolute URL
      const absoluteUrl = `${BASE_URL}${relativePath}`;

      res.json({ success: true, result: absoluteUrl });
    } catch (err) {
      // Keep logs detailed on server...
      console.error("TryOn error:", err);

      // ...and return a small useful subset to the client.
      const details = err?.details || undefined;
      const axiosResponse = err?.response
        ? {
            status: err.response.status,
            statusText: err.response.statusText,
            data: err.response.data,
          }
        : undefined;

      res.status(500).json({
        message: err?.message || "TryOn failed",
        details,
        axios: axiosResponse,
      });
    }
  }
);

module.exports = router;