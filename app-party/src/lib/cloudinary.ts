import { Cloudinary } from '@cloudinary/url-gen';

import { getOptionalEnv, getRequiredEnv } from './env';

export type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

export type CloudinaryUploadFile = {
  uri: string;
  name?: string;
  type?: string;
};

export type CloudinaryUploadOptions = {
  folder?: string;
  publicId?: string;
  resourceType?: CloudinaryResourceType;
  tags?: string[];
  context?: Record<string, string>;
};

export type CloudinaryUploadResponse = {
  asset_id: string;
  public_id: string;
  version: number;
  version_id?: string;
  signature?: string;
  width?: number;
  height?: number;
  format?: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder?: boolean;
  url: string;
  secure_url: string;
  original_filename?: string;
};

export const cloudinaryConfig = {
  cloudName: getRequiredEnv('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME'),
  uploadPreset: getRequiredEnv('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET'),
  uploadFolder: getOptionalEnv('EXPO_PUBLIC_CLOUDINARY_UPLOAD_FOLDER'),
};

export const cloudinary = new Cloudinary({
  cloud: {
    cloudName: cloudinaryConfig.cloudName,
  },
  url: {
    secure: true,
  },
});

export function getCloudinaryUploadUrl(resourceType: CloudinaryResourceType = 'auto'): string {
  return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`;
}

export function getCloudinaryImageUrl(publicId: string): string {
  return cloudinary.image(publicId).toURL();
}

export function getCloudinaryVideoUrl(publicId: string): string {
  return cloudinary.video(publicId).toURL();
}

export async function uploadToCloudinary(
  file: CloudinaryUploadFile,
  options: CloudinaryUploadOptions = {},
): Promise<CloudinaryUploadResponse> {
  const formData = new FormData();
  const resourceType = options.resourceType ?? 'auto';
  const folder = options.folder ?? cloudinaryConfig.uploadFolder;

  formData.append(
    'file',
    {
      uri: file.uri,
      name: file.name ?? 'party-upload',
      type: file.type ?? 'application/octet-stream',
    } as unknown as Blob,
  );
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);

  if (folder) {
    formData.append('folder', folder);
  }

  if (options.publicId) {
    formData.append('public_id', options.publicId);
  }

  if (options.tags?.length) {
    formData.append('tags', options.tags.join(','));
  }

  if (options.context) {
    formData.append(
      'context',
      Object.entries(options.context)
        .map(([key, value]) => `${key}=${value}`)
        .join('|'),
    );
  }

  const response = await fetch(getCloudinaryUploadUrl(resourceType), {
    method: 'POST',
    body: formData,
  });
  const payload = (await response.json()) as
    | CloudinaryUploadResponse
    | { error?: { message?: string } };

  if (!response.ok) {
    const message = 'error' in payload ? payload.error?.message : undefined;

    throw new Error(message ?? 'Cloudinary upload failed.');
  }

  return payload as CloudinaryUploadResponse;
}
