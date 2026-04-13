// tryonService.js - Core logic to call the Gradio API for virtual try-on.
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const zlib = require("zlib");
const crc32 = require("crc-32");
const sharp = require("sharp");

// Base URL of your Gradio app (no trailing slash). You can override via env.
const GRADIO_URL = process.env.GRADIO_URL || "https://d05b0ca04e7c698d23.gradio.live";
const GRADIO_API_NAME = process.env.GRADIO_API_NAME || "submit_function";

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function toAxiosDebug(err) {
  return {
    message: err?.message,
    code: err?.code,
    url: err?.config?.url,
    method: err?.config?.method,
    timeout: err?.config?.timeout,
    status: err?.response?.status,
    statusText: err?.response?.statusText,
    responseData: err?.response?.data,
  };
}

// ✅ FIX: Force RGB + JPEG (removes RGBA issues)
async function ensurePNG(buffer) {
  return await sharp(buffer)
    .png()
    .toBuffer();
}

// Build a valid all-black 768x1024 PNG buffer
function buildBlankPngBuffer(width = 768, height = 1024) {
  function u32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
  }
  function pngChunk(type, data) {
    const typeB = Buffer.from(type, "ascii");
    const crcVal = crc32.buf(Buffer.concat([typeB, data])) >>> 0;
    return Buffer.concat([u32(data.length), typeB, data, u32(crcVal)]);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])]));
  const row = Buffer.alloc(1 + width * 3, 0);
  const raw = Buffer.concat(Array(height).fill(row));
  const idat = pngChunk("IDAT", zlib.deflateSync(raw));
  const iend = pngChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

async function gradioUpload(fileBuffer, filename, mimeType, { timeoutMs = 60000 } = {}) {
  const base = normalizeBaseUrl(GRADIO_URL);
  const uploadUrl = `${base}/gradio_api/upload`;

  const form = new FormData();
  form.append("files", fileBuffer, { filename, contentType: mimeType });

  console.log(`[tryon] gradio:upload filename=${filename} size=${fileBuffer.length}`);

  const res = await axios.post(uploadUrl, form, {
    timeout: timeoutMs,
    validateStatus: () => true,
    headers: form.getHeaders(),
  });

  if (res.status < 200 || res.status >= 300) {
    const error = new Error(`Gradio upload failed (${filename})`);
    error.details = { step: "gradio/upload", url: uploadUrl, status: res.status, data: res.data };
    throw error;
  }

  const serverPath = Array.isArray(res.data) ? res.data[0] : res.data;
  if (!serverPath) {
    const error = new Error(`Gradio upload returned no path (${filename})`);
    error.details = { step: "gradio/upload", url: uploadUrl, data: res.data };
    throw error;
  }

  console.log(`[tryon] gradio:upload done path=${serverPath}`);

  return {
    path: serverPath,
    orig_name: filename,
    mime_type: mimeType,
    meta: { _type: "gradio.FileData" },
  };
}

async function gradioCall(apiName, data, { timeoutMs = 60000 } = {}) {
  const base = normalizeBaseUrl(GRADIO_URL);
  const callUrl = `${base}/gradio_api/call/${apiName}`;

  console.log(`[tryon] gradio:call:start url=${callUrl}`);

  const callRes = await axios.post(callUrl, { data }, {
    timeout: timeoutMs,
    validateStatus: () => true,
    headers: { "Content-Type": "application/json" },
  });

  if (callRes.status < 200 || callRes.status >= 300) {
    const error = new Error(`Gradio call failed (${apiName})`);
    error.details = { step: "gradio_api/call", url: callUrl, status: callRes.status, data: callRes.data };
    throw error;
  }

  const eventId = callRes.data?.event_id;
  if (!eventId) {
    const error = new Error(`Gradio call did not return event_id (${apiName})`);
    error.details = { step: "gradio_api/call", url: callUrl, data: callRes.data };
    throw error;
  }

  return { eventId };
}

async function gradioPoll(apiName, eventId, { maxWaitMs = 180000 } = {}) {
  const base = normalizeBaseUrl(GRADIO_URL);
  const eventsUrl = `${base}/gradio_api/call/${apiName}/${eventId}`;

  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const res = await axios.get(eventsUrl, {
      timeout: 60000,
      responseType: "text",
      transformResponse: (r) => r,
      validateStatus: () => true,
      headers: { Accept: "text/event-stream" },
    });

    const text = String(res.data || "");
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === "event: error") {
        throw new Error("Gradio job failed");
      }

      if (line === "event: complete") {
        const dataLine = lines[i + 1]?.trim() || "";
        const payload = dataLine.startsWith("data:") ? dataLine.slice(5).trim() : dataLine;
        return JSON.parse(payload);
      }
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  throw new Error("TryOn timeout");
}

async function runTryOn(personPath, clothPath) {
  const base = normalizeBaseUrl(GRADIO_URL);

  try {
    // Convert images to PNG BEFORE upload
    const personBuffer = await ensurePNG(fs.readFileSync(personPath));
    const clothBuffer = await ensurePNG(fs.readFileSync(clothPath));

    const [personFileData, clothFileData, blankLayerFileData] = await Promise.all([
      // Upload as PNGs
      gradioUpload(personBuffer, "person.png", "image/png"),
      gradioUpload(clothBuffer, "cloth.png", "image/png"),
      gradioUpload(buildBlankPngBuffer(), "mask.png", "image/png"),
    ]);

    const inputData = [
      {
        background: personFileData,
        layers: [blankLayerFileData], // ✅ FIX 2: Pass the mask layer here!
        composite: null
      },
      clothFileData,
      "overall",
      50,
      2.5,
      42,
      "result only",
    ];

    const { eventId } = await gradioCall(GRADIO_API_NAME, inputData);
    const outputData = await gradioPoll(GRADIO_API_NAME, eventId);

    const resultFileData = outputData?.[0];
    let resultUrl = resultFileData?.url || resultFileData?.path || null;

    if (resultUrl && resultUrl.startsWith("/")) {
      resultUrl = `${base}${resultUrl}`;
    }

    if (!resultUrl) throw new Error("No output URL");

    // ✅ Fetch the generated image from Gradio and save it locally to /uploads/
    // This avoids the separate /upload-generated round-trip from the client.
    const imgResponse = await axios.get(resultUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const filename = `generated_${Date.now()}.webp`;
    // __dirname is routes/ or wherever this file lives — go up one level to reach uploads/
    const uploadsDir = path.join(__dirname, "..", "uploads");
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(imgResponse.data));

    console.log(`[tryon] saved generated image: ${filename}`);

    // Return the relative path — caller uses fullUrl() in server.js to make it absolute
    return { relativePath: `/uploads/${filename}` };

  } catch (err) {
    console.error("[tryon] error", toAxiosDebug(err) || err);
    throw err;
  }
}

module.exports = { runTryOn };