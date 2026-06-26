import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

export const INCIDENT_IMAGES_BUCKET = 'incident-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function refreshSupabaseSession(): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await supabase.auth.refreshSession();
    }
  } catch (error) {
    // Uploads can still succeed without an auth session after storage policy update.
    console.warn('Unable to refresh Supabase session before image upload:', error);
  }
}

export interface IncidentImageSelection {
  uri: string;
  mimeType?: string | null;
}

function getExtension(uri: string, mimeType?: string | null): string {
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  if (mimeType?.includes('heic') || mimeType?.includes('heif')) return 'heic';
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (match?.[1]) return match[1].toLowerCase();
  return 'jpg';
}

function getContentType(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return 'image/jpeg';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getUploadErrorMessage(errorMessage: string): string {
  const message = errorMessage.toLowerCase();

  if (message.includes('bucket not found') || message.includes('does not exist')) {
    return 'Incident image storage is not set up yet. Apply the add_incident_images Supabase migration.';
  }

  if (message.includes('row-level security') || message.includes('permission denied') || message.includes('not authorized')) {
    return 'Unable to upload incident photo. Please try again.';
  }

  if (message.includes('payload too large') || message.includes('file size')) {
    return 'Image must be smaller than 5 MB.';
  }

  return errorMessage || 'Failed to upload image to storage.';
}

async function readImageBytes(imageUri: string): Promise<ArrayBuffer> {
  const fileInfo = await FileSystem.getInfoAsync(imageUri, { size: true });

  if (!fileInfo.exists) {
    throw new Error('Selected image file could not be found.');
  }

  if (typeof fileInfo.size === 'number' && fileInfo.size > MAX_IMAGE_BYTES) {
    throw new Error('Image must be smaller than 5 MB.');
  }

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return base64ToArrayBuffer(base64);
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

export async function pickIncidentImageFromLibrary(): Promise<IncidentImageSelection | null> {
  const granted = await requestMediaLibraryPermission();
  if (!granted) {
    throw new Error('Photo library permission is required to attach an image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.82,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType,
  };
}

export async function takeIncidentPhoto(): Promise<IncidentImageSelection | null> {
  const granted = await requestCameraPermission();
  if (!granted) {
    throw new Error('Camera permission is required to take a photo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.82,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType,
  };
}

export function buildIncidentImagePath(
  userId: string,
  incidentId: string,
  imageUri: string,
  mimeType?: string | null
): { filePath: string; contentType: string } {
  const ext = getExtension(imageUri, mimeType);
  const contentType = mimeType || getContentType(ext);
  const filePath = `${userId}/${incidentId}-${Date.now()}.${ext}`;
  return { filePath, contentType };
}

export async function uploadIncidentImage(
  userId: string,
  incidentId: string,
  imageUri: string,
  mimeType?: string | null
): Promise<string> {
  await refreshSupabaseSession();

  const arrayBuffer = await readImageBytes(imageUri);
  const { filePath, contentType } = buildIncidentImagePath(userId, incidentId, imageUri, mimeType);

  const { error: uploadError } = await supabase.storage.from(INCIDENT_IMAGES_BUCKET).upload(filePath, arrayBuffer, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });

  if (uploadError) {
    throw new Error(getUploadErrorMessage(uploadError.message));
  }

  const { data } = supabase.storage.from(INCIDENT_IMAGES_BUCKET).getPublicUrl(filePath);
  if (!data.publicUrl) {
    await deleteIncidentImage(filePath);
    throw new Error('Failed to get public image URL.');
  }

  return data.publicUrl;
}

export async function deleteIncidentImage(filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(INCIDENT_IMAGES_BUCKET).remove([filePath]);
  if (error) {
    console.error('Failed to delete incident image:', error.message);
  }
}

export function getIncidentImagePathFromUrl(imageUrl: string): string | null {
  const marker = `/storage/v1/object/public/${INCIDENT_IMAGES_BUCKET}/`;
  const index = imageUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(imageUrl.slice(index + marker.length));
}
