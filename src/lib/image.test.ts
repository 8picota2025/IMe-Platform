import { describe, expect, it } from 'vitest';
import { getOptimizedImageUrl, isSupabaseStorageImage } from './image';

describe('Supabase image optimization', () => {
  const source = 'https://project.supabase.co/storage/v1/object/public/productos/demo/equipo.jpg';

  it('uses the render endpoint with explicit dimensions and format', () => {
    expect(getOptimizedImageUrl(source, 400, 'avif')).toBe(
      'https://project.supabase.co/storage/v1/render/image/public/productos/demo/equipo.jpg?width=400&quality=76&format=avif'
    );
  });

  it('does not transform local or third-party images', () => {
    expect(isSupabaseStorageImage('/assets/productos/equipo.jpg')).toBe(false);
    expect(getOptimizedImageUrl('/assets/productos/equipo.jpg', 400, 'webp')).toBe(
      '/assets/productos/equipo.jpg'
    );
  });
});
