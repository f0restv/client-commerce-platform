import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3ClientInstance: S3Client | null = null;

/**
 * Get or create S3 client with validation
 */
function getS3Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  const requiredEnvVars = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  };

  const missing = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required AWS credentials: ${missing.join(', ')}. ` +
        'Please set these environment variables before using image upload.'
    );
  }

  s3ClientInstance = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: requiredEnvVars.AWS_ACCESS_KEY_ID!,
      secretAccessKey: requiredEnvVars.AWS_SECRET_ACCESS_KEY!,
    },
  });

  return s3ClientInstance;
}

function getBucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error(
      'AWS_S3_BUCKET environment variable is required for image upload'
    );
  }
  return bucket;
}

// Whitelisted folder prefixes
const ALLOWED_FOLDERS = ['products', 'uploads', 'submissions', 'temp'] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

/**
 * Sanitize and validate a key to prevent path traversal
 */
function sanitizeKey(key: string): string {
  // Remove any path traversal attempts
  const sanitized = key
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .trim();

  // Only allow alphanumeric, hyphens, underscores, and single forward slashes
  if (!/^[a-zA-Z0-9_\-\/\.]+$/.test(sanitized)) {
    throw new Error(
      `Invalid key format: "${key}". Only alphanumeric, hyphens, underscores, and forward slashes are allowed.`
    );
  }

  return sanitized;
}

/**
 * Validate folder is in whitelist
 */
function validateFolder(folder: string): AllowedFolder {
  if (!ALLOWED_FOLDERS.includes(folder as AllowedFolder)) {
    throw new Error(
      `Invalid folder: "${folder}". Must be one of: ${ALLOWED_FOLDERS.join(', ')}`
    );
  }
  return folder as AllowedFolder;
}

/**
 * Build a safe key with validated folder and sanitized filename
 */
function buildSafeKey(folder: string, key: string): string {
  const validatedFolder = validateFolder(folder);
  const sanitizedKey = sanitizeKey(key);
  return `${validatedFolder}/${sanitizedKey}`;
}

export interface UploadOptions {
  folder?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PresignedUploadUrl {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * Generate a presigned URL for uploading an image
 * Returns both the upload URL and the eventual public URL
 */
export async function generatePresignedUploadUrl(
  key: string,
  folder: string = 'uploads',
  options: {
    expiresIn?: number;
    contentType?: string;
    maxContentLength?: number;
  } = {}
): Promise<PresignedUploadUrl> {
  const {
    expiresIn = 3600,
    contentType = 'image/jpeg',
    maxContentLength = 10 * 1024 * 1024, // 10MB default
  } = options;

  const safeKey = buildSafeKey(folder, key);
  const s3Client = getS3Client();
  const bucketName = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: safeKey,
    ContentType: contentType,
  });

  // Add content-length constraint to the presigned policy
  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn,
    signableHeaders: new Set(['content-type', 'content-length']),
  });

  const publicUrl = getImageUrl(safeKey);

  return {
    uploadUrl,
    publicUrl,
    key: safeKey,
  };
}

/**
 * Upload an image buffer to S3
 */
export async function uploadImage(
  buffer: Buffer,
  key: string,
  options: UploadOptions = {}
): Promise<string> {
  const { folder = 'uploads', contentType = 'image/jpeg', metadata = {} } = options;

  const safeKey = buildSafeKey(folder, key);
  const s3Client = getS3Client();
  const bucketName = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: safeKey,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  await s3Client.send(command);

  return safeKey;
}

/**
 * Get the public URL for an image
 */
export function getImageUrl(key: string): string {
  const cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  const sanitizedKey = encodeURIComponent(key).replace(/%2F/g, '/');
  
  if (cloudFrontDomain) {
    return `https://${cloudFrontDomain}/${sanitizedKey}`;
  }
  
  const bucketName = getBucketName();
  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${sanitizedKey}`;
}

/**
 * Upload multiple versions of an image
 */
export async function uploadImageVersions(
  versions: Array<{ buffer: Buffer; size: string; key: string }>,
  folder: string
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};

  await Promise.all(
    versions.map(async ({ buffer, size, key }) => {
      const uploadedKey = await uploadImage(buffer, key, {
        folder,
        contentType: 'image/jpeg',
        metadata: { size },
      });
      urls[size] = getImageUrl(uploadedKey);
    })
  );

  return urls;
}
