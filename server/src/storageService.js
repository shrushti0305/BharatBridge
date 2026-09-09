import fs from "fs";
import path from "path";

/**
 * Cloud Storage Abstraction Layer for BharatBridge (TryLang)
 * Supports:
 * 1. Azure Blob Storage (if AZURE_STORAGE_CONNECTION_STRING is set)
 * 2. AWS S3 Storage (if AWS_ACCESS_KEY_ID & AWS_S3_BUCKET_NAME are set)
 * 3. Local Server Storage (Default fallback: ./data/audio/)
 */

export async function uploadAudioFile({ filePath, fileName, mimeType = "audio/webm" }) {
  const azureConnString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const azureContainer = process.env.AZURE_STORAGE_CONTAINER_NAME || "audio-recordings";

  const awsBucket = process.env.AWS_S3_BUCKET_NAME;
  const awsRegion = process.env.AWS_REGION || "ap-south-1";

  // 1. Azure Blob Storage Upload
  if (azureConnString) {
    try {
      const { BlobServiceClient } = await import("@azure/storage-blob");
      const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnString);
      const containerClient = blobServiceClient.getContainerClient(azureContainer);
      await containerClient.createIfNotExists({ access: "blob" });

      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      const fileBuffer = fs.readFileSync(filePath);
      await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: { blobContentType: mimeType },
      });

      console.log(`☁️ [Azure Blob] Uploaded audio: ${blockBlobClient.url}`);
      return blockBlobClient.url;
    } catch (err) {
      console.error("❌ Azure Blob upload failed, using local file:", err.message);
    }
  }

  // 2. AWS S3 Upload
  if (awsBucket && process.env.AWS_ACCESS_KEY_ID) {
    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3Client = new S3Client({
        region: awsRegion,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const fileBuffer = fs.readFileSync(filePath);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: awsBucket,
          Key: fileName,
          Body: fileBuffer,
          ContentType: mimeType,
        })
      );

      const s3Url = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/${fileName}`;
      console.log(`☁️ [AWS S3] Uploaded audio: ${s3Url}`);
      return s3Url;
    } catch (err) {
      console.error("❌ AWS S3 upload failed, using local file:", err.message);
    }
  }

  // 3. Local Storage (Default Fallback)
  const relativeUrl = `/audio/${fileName}`;
  console.log(`📁 [Local Storage] Audio saved locally: ${relativeUrl}`);
  return relativeUrl;
}
