import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.DO_SPACE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.DO_SPACE_ACCESS_KEY || "",
    secretAccessKey: process.env.DO_SPACE_SECRET_KEY || "",
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    public_id: (req, file) => `${Date.now()}_${file.originalname}`,
  },
});

const cloudinaryUpload = multer({ storage: cloudinaryStorage });

const uploadSingle = upload.single("image");
const uploadFile = upload.single("file");

const uploadMultipleImage = upload.fields([{ name: "images", maxCount: 15 }]);
const uploadMultipleFiles = upload.fields([{ name: "files", maxCount: 15 }]);

const userMutipleFiles = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder: string = "uploads",
): Promise<{ Location: string; public_id: string }> => {
  if (!file) {
    throw new Error("File is required for uploading.");
  }

  return new Promise((resolve, reject) => {
    const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(2)}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, "_")}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: "auto",
        public_id: uniqueFilename.split(".")[0],
        unique_filename: true,
        overwrite: false,
        quality: "auto",
        fetch_format: "auto",
      },
      (error, result) => {
        if (error) {
          console.error("Error uploading file to Cloudinary:", error);
          return reject(error);
        }

        resolve({
          Location: result?.secure_url || "",
          public_id: result?.public_id || "",
        });
      },
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const uploadToDigitalOcean = async (file: Express.Multer.File) => {
  if (!file) {
    throw new Error("File is required for uploading.");
  }

  try {
    const Key = `nathancloud/${Date.now()}_${uuidv4()}_${file.originalname}`;
    const uploadParams = {
      Bucket: process.env.DO_SPACE_BUCKET || "",
      Key,
      Body: file.buffer,
      ACL: "public-read" as ObjectCannedACL,
      ContentType: file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const fileURL = `${process.env.DO_SPACE_ENDPOINT}/${process.env.DO_SPACE_BUCKET}/${Key}`;
    return {
      Location: fileURL,
      Bucket: process.env.DO_SPACE_BUCKET || "",
      Key,
    };
  } catch (error) {
    console.error("Error uploading file to DigitalOcean:", error);
    throw error;
  }
};

const uploadProfileImage = async (file: Express.Multer.File) => {
  return uploadToCloudinary(file, "profile-images");
};

const uploadGeneralFile = async (file: Express.Multer.File) => {
  return uploadToCloudinary(file, "user-files");
};

export const fileUploader = {
  upload,
  uploadSingle,
  uploadMultipleFiles,
  uploadMultipleImage,
  userMutipleFiles,
  uploadFile,
  cloudinaryUpload,
  uploadToDigitalOcean,
  uploadToCloudinary,
  uploadProfileImage,
  uploadGeneralFile,
};
