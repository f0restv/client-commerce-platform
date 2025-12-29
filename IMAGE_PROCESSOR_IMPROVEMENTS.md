# Image Processor Security & Robustness Improvements

## Issues Fixed

### 1. ✅ Presigned URL Security (upload.ts)
**Problem:** `generatePresignedUrl` used `GetObjectCommand`, creating download URLs instead of upload targets. With user-supplied keys, this could grant read access to arbitrary S3 objects.

**Fix:**
- Renamed to `generatePresignedUploadUrl` returning `PresignedUploadUrl` type
- Changed to `PutObjectCommand` for proper upload URLs
- Added content-type and content-length constraints to presigned policy
- Returns both upload URL and eventual public URL
- Enforces whitelisted folders and sanitized keys

### 2. ✅ Lazy S3 Client Initialization (upload.ts)
**Problem:** S3 credentials instantiated at module scope with `!` assertions would crash the entire process if env vars were missing.

**Fix:**
- Created `getS3Client()` function with lazy initialization
- Validates `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` before creating client
- Clear error messages listing missing variables
- Process can start without S3 credentials (fails only when upload is attempted)
- Single client instance reused across calls

### 3. ✅ Key Validation & Sanitization (upload.ts)
**Problem:** No validation allowed path traversal (`../`), folder escaping, or overwriting arbitrary objects.

**Fix:**
- Created `ALLOWED_FOLDERS` whitelist: `['products', 'uploads', 'submissions', 'temp']`
- `sanitizeKey()` removes `..`, leading slashes, double slashes, validates alphanumeric
- `validateFolder()` enforces whitelist
- `buildSafeKey()` combines validated folder + sanitized key
- All upload functions use `buildSafeKey()` internally

### 4. ✅ Claude JSON Parsing (analyze.ts)
**Problem:** Regex-based JSON extraction (`/\{[\s\S]*\}/`) would break silently on formatting changes.

**Fix:**
- Prompt explicitly requests "valid JSON" without markdown/code blocks
- Handles markdown code blocks if present: strips ```json wrappers
- Direct `JSON.parse()` with try-catch
- `validateImageAnalysis()` validates every field against schema:
  - `issues[]` structure and types
  - `overallQuality` enum values
  - `recommendations[]` array
- Returns typed `AnalysisResult` with `success` boolean and optional `error`

### 5. ✅ Error Handling (analyze.ts)
**Problem:** Failures returned `{ overallQuality: 'good', recommendations: ['Unable to analyze'] }`, hiding real issues.

**Fix:**
- Returns `AnalysisResult` envelope: `{ success: boolean, data?: ImageAnalysis, error?: string }`
- `recommendEnhancements()` checks `analysisResult.success` before processing
- Pipeline can fail early if analysis fails and no custom enhancements provided
- Callers can retry, surface errors, or degrade gracefully
- No silent masking of failures

## Additional Improvements

### Type Safety
- Exported `AnalysisResult` and `PresignedUploadUrl` types
- Stronger validation at runtime matches compile-time types
- Proper error propagation through the pipeline

### Security
- Key sanitization prevents directory traversal
- Folder whitelist prevents arbitrary writes
- URL encoding in `getImageUrl()` handles special characters
- Content-type constraints on presigned uploads

### Error Messages
- Clear, actionable error messages
- Lists missing environment variables
- Identifies invalid folders/keys
- Validates JSON schema fields with specific errors

---

## What I Would Have Done Differently

### Architecture

**Dependency Injection:**
```typescript
interface ImageProcessor {
  s3Client: S3Client;
  anthropicClient: Anthropic;
  config: ImageProcessorConfig;
}

// Pass clients in, not global singletons
export function createImageProcessor(config: ImageProcessorConfig): ImageProcessor {
  return {
    s3Client: createS3Client(config.aws),
    anthropicClient: new Anthropic({ apiKey: config.anthropic.apiKey }),
    config,
  };
}
```

**Benefits:**
- Testable without environment variables
- Mock S3/Anthropic in tests
- Multiple instances with different configs
- Clear configuration boundaries

### Credential Management

**Configuration Helper:**
```typescript
interface AWSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  cloudFrontDomain?: string;
}

function validateAWSConfig(): AWSConfig {
  const config = {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_S3_BUCKET,
    cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'cloudFrontDomain' && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required AWS configuration: ${missing.join(', ')}`
    );
  }

  return config as AWSConfig;
}
```

### Upload Security

**Enhanced Key Generation:**
```typescript
interface UploadContext {
  userId: string;
  resourceType: 'product' | 'submission' | 'profile';
  contentHash?: string; // SHA-256 for deduplication
}

function generateSecureKey(context: UploadContext): string {
  const uuid = randomUUID();
  const prefix = `${context.resourceType}/${context.userId}`;
  
  // Check content hash for dedupe
  if (context.contentHash) {
    const existing = await findByContentHash(context.contentHash);
    if (existing) return existing.key;
  }
  
  return `${prefix}/${uuid}.jpg`;
}
```

**Presigned Upload with Policies:**
```typescript
interface PresignedUploadPolicy {
  key: string;
  contentType: string;
  maxSizeBytes: number;
  expiresIn: number;
}

function generatePresignedUpload(policy: PresignedUploadPolicy): PresignedUploadUrl {
  // Server-side generated key only
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: policy.key,
    ContentType: policy.contentType,
    // Add conditions to the presigned URL
  });

  // Short expiration (15 min)
  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: Math.min(policy.expiresIn, 900),
    signableHeaders: new Set(['content-type', 'content-length']),
  });

  return { uploadUrl, publicUrl: getImageUrl(policy.key), key: policy.key };
}
```

### Claude Integration

**Schema-Based Parsing:**
```typescript
import { z } from 'zod';

const ImageIssueSchema = z.object({
  type: z.enum(['dust', 'scratch', 'lighting', 'background', 'color_cast']),
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string(),
  location: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const ImageAnalysisSchema = z.object({
  issues: z.array(ImageIssueSchema),
  overallQuality: z.enum(['poor', 'fair', 'good', 'excellent']),
  recommendations: z.array(z.string()),
});

async function analyzeImage(buffer: Buffer): Promise<Result<ImageAnalysis>> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      // Request JSON mode if available in future API versions
      messages: [/* ... */],
    });

    const parsed = JSON.parse(extractJSON(message));
    const validated = ImageAnalysisSchema.parse(parsed);
    
    return { success: true, data: validated };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof z.ZodError 
        ? `Schema validation failed: ${error.message}`
        : error.message 
    };
  }
}
```

### Enhancement Rules Engine

**Rule Table Pattern:**
```typescript
interface EnhancementRule {
  issueType: ImageIssue['type'];
  severity: ImageIssue['severity'][];
  enhancement: keyof EnhancementOptions;
}

const ENHANCEMENT_RULES: EnhancementRule[] = [
  { issueType: 'lighting', severity: ['low', 'medium', 'high'], enhancement: 'autoLevels' },
  { issueType: 'color_cast', severity: ['medium', 'high'], enhancement: 'whiteBalance' },
  { issueType: 'dust', severity: ['low'], enhancement: 'denoise' },
  { issueType: 'background', severity: ['medium', 'high'], enhancement: 'removeBackground' },
];

function recommendEnhancements(analysis: ImageAnalysis): EnhancementOptions {
  const enhancements: EnhancementOptions = { sharpen: true }; // Always sharpen

  for (const issue of analysis.issues) {
    const matchingRule = ENHANCEMENT_RULES.find(
      rule => rule.issueType === issue.type && rule.severity.includes(issue.severity)
    );
    
    if (matchingRule) {
      enhancements[matchingRule.enhancement] = true;
    }
  }

  return enhancements;
}
```

### Performance Optimizations

**Stream Processing:**
```typescript
// Avoid base64 encoding entire image in memory
async function analyzeImageStream(stream: Readable): Promise<AnalysisResult> {
  // Upload to temporary S3 location
  const tempKey = await uploadStream(stream, 'temp');
  
  // Send S3 URL to Claude (if supported)
  const analysis = await anthropic.messages.create({
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'url', url: getPresignedUrl(tempKey) }
      }]
    }]
  });
  
  // Clean up temp
  await deleteObject(tempKey);
  
  return parseAnalysis(analysis);
}
```

**Batch Uploads:**
```typescript
async function uploadImageVersions(versions: ImageVersion[]): Promise<UploadResults> {
  const s3Client = getS3Client();
  
  // Batch with shared client & options
  const commands = versions.map(v => new PutObjectCommand({
    Bucket: config.bucket,
    Key: v.key,
    Body: v.buffer,
    ContentType: 'image/jpeg',
    Metadata: { size: v.size },
  }));

  const results = await Promise.allSettled(
    commands.map(cmd => s3Client.send(cmd))
  );

  return processResults(results, versions);
}
```

### Retry & Resilience

**Exponential Backoff:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options = { maxRetries: 3, baseDelay: 1000 }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < options.maxRetries) {
        const delay = options.baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

// Usage
const analysis = await withRetry(() => anthropic.messages.create({...}));
```

### Observability

**Structured Logging:**
```typescript
interface LogContext {
  operation: string;
  imageId: string;
  userId?: string;
  duration?: number;
}

function log(level: 'info' | 'error', message: string, context: LogContext) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    // Redact sensitive data
    userId: context.userId ? redact(context.userId) : undefined,
  }));
}

// Usage
const start = Date.now();
try {
  const result = await processImage(buffer);
  log('info', 'Image processed successfully', {
    operation: 'processImage',
    imageId: result.id,
    duration: Date.now() - start,
  });
} catch (error) {
  log('error', 'Image processing failed', {
    operation: 'processImage',
    imageId: imageId,
    duration: Date.now() - start,
  });
}
```

### Testing Strategy

**Integration Tests with Mocks:**
```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Mock = mockClient(S3Client);

describe('Image Upload', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('should upload image with validated key', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await uploadImage(buffer, 'test.jpg', { folder: 'products' });

    expect(s3Mock.calls()).toHaveLength(1);
    expect(s3Mock.call(0).args[0].input.Key).toBe('products/test.jpg');
  });

  it('should reject invalid folder', async () => {
    await expect(
      uploadImage(buffer, 'test.jpg', { folder: '../secrets' })
    ).rejects.toThrow('Invalid folder');
  });
});
```

### Security Hardening

**Additional Measures:**
```typescript
// 1. KMS encryption
const command = new PutObjectCommand({
  Bucket: config.bucket,
  Key: key,
  Body: buffer,
  ServerSideEncryption: 'aws:kms',
  SSEKMSKeyId: config.kmsKeyId,
});

// 2. Bucket policies (infrastructure)
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "s3.amazonaws.com"},
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::bucket/uploads/*",
    "Condition": {
      "StringEquals": {
        "s3:x-amz-server-side-encryption": "aws:kms"
      }
    }
  }]
}

// 3. Content validation
function validateImageBuffer(buffer: Buffer): void {
  const metadata = sharp(buffer).metadata();
  
  if (metadata.format not in ['jpeg', 'png', 'webp']) {
    throw new Error('Invalid image format');
  }
  
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Image too large');
  }
}
```

---

## Summary

The refactored code is now:
- **Secure**: No path traversal, proper upload URLs, validated inputs
- **Robust**: Lazy initialization, proper error handling, schema validation
- **Maintainable**: Clear error messages, typed results, separation of concerns
- **Testable**: Can mock external services, validate behavior in isolation

For production, I'd additionally add: dependency injection, retry logic, structured logging, comprehensive tests, KMS encryption, and monitoring/alerting hooks.
