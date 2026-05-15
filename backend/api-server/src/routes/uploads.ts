import { createHash } from "crypto";
import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
  limits: { fileSize: 600 * 1024 },
});

const signCloudinaryParams = (params: Record<string, string>, apiSecret: string) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
};

const uploadToCloudinary = async (file: Express.Multer.File, folder: string) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { folder, timestamp };
  const signature = signCloudinaryParams(signedParams, apiSecret);
  const formData = new FormData();

  formData.set("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  formData.set("api_key", apiKey);
  formData.set("timestamp", timestamp);
  formData.set("folder", folder);
  formData.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || "Failed to upload image to Cloudinary");
  }

  return data as { secure_url: string; public_id: string };
};

router.post("/uploads/invoice-logo", authMiddleware, upload.single("logo"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Logo file is required" });
    return;
  }

  const folder = `showroom-pro/invoice-logos/user-${req.userId}`;
  let data: { secure_url: string; public_id: string };
  try {
    data = await uploadToCloudinary(req.file, folder);
  } catch (error) {
    res.status(error instanceof Error && error.message === "Cloudinary is not configured" ? 500 : 502).json({
      error: error instanceof Error ? error.message : "Failed to upload logo to Cloudinary",
    });
    return;
  }

  await db.users.updateOne(
    { id: req.userId! },
    { $set: { invoiceLogoUrl: data.secure_url, updatedAt: new Date() } },
  );

  res.status(201).json({
    url: data.secure_url,
    publicId: data.public_id,
  });
});

router.post("/uploads/product-image", authMiddleware, upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Product image file is required" });
    return;
  }

  const folder = `showroom-pro/product-images/user-${req.userId}`;
  try {
    const data = await uploadToCloudinary(req.file, folder);
    res.status(201).json({
      url: data.secure_url,
      publicId: data.public_id,
    });
  } catch (error) {
    res.status(error instanceof Error && error.message === "Cloudinary is not configured" ? 500 : 502).json({
      error: error instanceof Error ? error.message : "Failed to upload product image to Cloudinary",
    });
  }
});

router.delete("/uploads/invoice-logo", authMiddleware, async (req, res): Promise<void> => {
  await db.users.updateOne(
    { id: req.userId! },
    { $set: { invoiceLogoUrl: null, updatedAt: new Date() } },
  );

  res.json({ success: true });
});

export default router;
