import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROBOT_IMPORT_GALLERY_COUNT,
  robotImportedGallery,
  robotImportedMainImage,
  robotImportedPdfPath,
} from './robot-media';

const publicRoot = path.resolve(process.cwd(), 'public');

function assertPublicFile(url: string): void {
  const file = path.join(publicRoot, url.replace(/^\//, ''));
  expect(existsSync(file), url).toBe(true);
  expect(statSync(file).size, url).toBeGreaterThan(1000);
}

describe('medios de robots importados', () => {
  it('resuelve PadBot T2 a la carpeta legado, no al slug SEO', () => {
    const slug = 'padbot-t2-robot-educativo-social-ref-padbot-t2-padbot';
    expect(robotImportedMainImage(slug)).toBe(
      '/assets/productos/importados/padbot-t2-robot-educativo-social/robot-producto-robot-educativo-social-tercera-edad-padbot-t2.webp'
    );
    expect(robotImportedGallery(slug)).toEqual([
      '/assets/productos/importados/padbot-t2-robot-educativo-social/robot-producto-robot-educativo-social-tercera-edad-padbot-t2.webp',
      '/assets/productos/importados/padbot-t2-robot-educativo-social/robot-galeria-robot-educativo-social-tercera-edad-padbot-t2-02.webp',
      '/assets/productos/importados/padbot-t2-robot-educativo-social/robot-galeria-robot-educativo-social-tercera-edad-padbot-t2-03.webp',
    ]);
    expect(
      robotImportedPdfPath(
        slug,
        '/assets/productos/importados/padbot-t2-robot-educativo-social-ref-padbot-t2-padbot/ficha-padbot-t2-robot-educativo-social.pdf'
      )
    ).toBe(
      '/assets/productos/importados/padbot-t2-robot-educativo-social/ficha-padbot-t2-robot-educativo-social.pdf'
    );
  });

  it('cada robot del catálogo apunta a imágenes que existen en public/', () => {
    for (const slug of Object.keys(ROBOT_IMPORT_GALLERY_COUNT)) {
      const images = robotImportedGallery(slug);
      expect(images, slug).not.toBeNull();
      expect(images!.length).toBeGreaterThan(1);
      expect(images![0]).toBe(robotImportedMainImage(slug));
      expect(
        images!.some(url => url.includes(`/importados/${slug}/`)),
        slug
      ).toBe(false);
      for (const url of images!) assertPublicFile(url);
    }
  });
});
