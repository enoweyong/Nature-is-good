import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const TABLE_NAME = process.env.TABLE_NAME!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

export const handler = async (event: any) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { category, title, sub, desc, type, imageUrl, mediaUrl, mediaType, imageData, contentType } = body;
    const id = body.id || randomUUID();
    if (!category || !title || !desc) return response(400, { error: 'Category, title, and description are required' });

    let storedImageUrl = mediaUrl || imageUrl || '';
    let storedMediaType = mediaType === 'video' ? 'video' : 'image';
    let embedUrl = '';
    if (storedImageUrl && !/^https?:\/\//i.test(storedImageUrl)) {
      return response(400, { error: 'mediaUrl must be a public http or https URL' });
    }
    if (storedImageUrl) {
      const externalMedia = classifyExternalMedia(storedImageUrl, mediaType);
      storedMediaType = externalMedia.mediaType;
      embedUrl = externalMedia.embedUrl;
    }
    if (imageData) {
      const match = String(imageData).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return response(400, { error: 'imageData must be a base64 data URL' });
      const objectKey = `images/${category}/${id}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: Buffer.from(match[2], 'base64'),
        ContentType: contentType || match[1],
      }));
      storedImageUrl = `https://${CLOUDFRONT_DOMAIN}/${objectKey}`;
    }

    const item = {
      category,
      id,
      title,
      sub: sub || '',
      desc,
      type: type || 'user',
      likes: 0,
      views: 0,
      imageUrl: storedImageUrl,
      mediaUrl: storedImageUrl,
      mediaType: imageData ? (contentType || '').startsWith('video/') ? 'video' : 'image' : storedMediaType,
      embedUrl: imageData ? '' : embedUrl,
      createdAt: new Date().toISOString(),
    };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return response(201, item);
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function classifyExternalMedia(rawUrl: string, requestedType?: string): { mediaType: 'image' | 'video' | 'embed'; embedUrl: string } {
  const url = new URL(rawUrl);
  if (requestedType === 'image') return { mediaType: 'image', embedUrl: '' };
  if (requestedType === 'video') return { mediaType: 'video', embedUrl: '' };
  if (requestedType === 'embed') return { mediaType: 'embed', embedUrl: rawUrl };
  const pathname = url.pathname.toLowerCase();
  if (/\.(avif|gif|jpe?g|png|webp)$/i.test(pathname)) return { mediaType: 'image', embedUrl: '' };
  if (/\.(m3u8|mov|mp4|ogv|webm)$/i.test(pathname)) return { mediaType: 'video', embedUrl: '' };

  if (url.hostname === 'youtu.be') {
    const videoId = url.pathname.slice(1).split('/')[0];
    if (videoId) return { mediaType: 'embed', embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` };
  }
  if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) {
    const videoId = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
    if (videoId) return { mediaType: 'embed', embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` };
  }
  if (url.hostname === 'vimeo.com' || url.hostname.endsWith('.vimeo.com')) {
    const videoId = url.pathname.split('/').filter(Boolean).pop();
    if (videoId && /^\d+$/.test(videoId)) return { mediaType: 'embed', embedUrl: `https://player.vimeo.com/video/${videoId}` };
  }
  return { mediaType: 'embed', embedUrl: rawUrl };
}
