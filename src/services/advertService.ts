import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, hasValidSupabaseConfig } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { Advert } from '../types';

export const ADVERT_IMAGES_BUCKET = 'advert-images';

function resolveAdvertImageUrl(image: string): string {
  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  const { data } = supabase.storage.from(ADVERT_IMAGES_BUCKET).getPublicUrl(image);
  return data.publicUrl;
}

class AdvertService {
  async getUserState(): Promise<string | null> {
    try {
      const userDataString = await AsyncStorage.getItem('user');
      if (!userDataString) return null;

      const userData = JSON.parse(userDataString) as { state?: string | null };
      const state = userData.state?.trim();
      return state || null;
    } catch (error) {
      logger.warn('Unable to read user state for advert:', error);
      return null;
    }
  }

  async getActiveAdvertForState(state: string): Promise<Advert | null> {
    if (!hasValidSupabaseConfig || !state.trim()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('advert')
        .select('id, state, image, action, timer, created_at, updated_at')
        .eq('action', true)
        .ilike('state', state.trim())
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching advert:', error?.message || error?.code || String(error));
        return null;
      }

      if (!data?.image) {
        return null;
      }

      return {
        id: data.id,
        state: data.state,
        image: resolveAdvertImageUrl(data.image),
        action: data.action,
        timer: typeof data.timer === 'number' ? data.timer : 15,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      logger.error('Error in getActiveAdvertForState:', error);
      return null;
    }
  }

  async getActiveAdvertForUser(): Promise<Advert | null> {
    const state = await this.getUserState();
    if (!state) {
      return null;
    }

    return this.getActiveAdvertForState(state);
  }
}

export const advertService = new AdvertService();
