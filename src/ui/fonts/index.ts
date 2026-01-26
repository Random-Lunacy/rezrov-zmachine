/**
 * Font system exports
 */

export { FONT3_BITMAPS, getAvailableFont3Codes, getFont3Bitmap, hasFont3Bitmap } from './Font3Bitmaps';
export { Font3System } from './Font3System';
export {
  font3StringToUnicode,
  font3ToUnicode,
  getArrowCharacters,
  getBoxDrawingCharacters,
  getFont3Category,
  getRunicCharacters,
  getSpecialCharacters,
  hasFont3Mapping,
  translateFont3Text,
} from './Font3Unicode';
export { FontManager } from './FontManager';

export type { Font3BitmapData } from './Font3Bitmaps';
export type { Font3Character, Font3Font } from './Font3System';
export type { Font3Category } from './Font3Unicode';
export { FontType } from './FontManager';
export type { FontInfo } from './FontManager';
