/**
 * Font 3 to Unicode Mapping for Terminal Display
 *
 * Maps Z-Machine Font 3 character codes to Unicode equivalents for rendering
 * in text terminals. The printable range (32-126) uses the authoritative mapping
 * from Bocfel (unicode.cpp:build_zscii_to_character_graphics_table).
 *
 * Font 3 Character Ranges:
 * - 0-31: Control characters (space)
 * - 32-126: Character graphics (box drawing, blocks, arrows, runes)
 * - 128-159: Box drawing characters (extended)
 * - 160-175: Arrows and directional symbols (extended)
 * - 176-207: Runic alphabet (extended)
 * - 208-255: Special symbols and graphics (extended)
 */

/**
 * Font 3 printable range (codes 32-126) mapped to Unicode
 * Sourced from Bocfel Z-machine interpreter (unicode.cpp)
 *
 * This is the primary mapping used by Beyond Zork for its map display,
 * status area borders, and graphical elements.
 */
const FONT3_PRINTABLE_MAP: Record<number, string> = {
  32: ' ', // Space
  33: '\u2190', // ← Left arrow
  34: '\u2192', // → Right arrow
  35: '\u2571', // ╱ Box drawings light diagonal upper right to lower left
  36: '\u2572', // ╲ Box drawings light diagonal upper left to lower right
  37: ' ', // Space
  38: '\u2500', // ─ Horizontal line
  39: '\u2500', // ─ Horizontal line
  40: '\u2502', // │ Vertical line
  41: '\u2502', // │ Vertical line
  42: '\u2534', // ┴ Up and horizontal
  43: '\u252C', // ┬ Down and horizontal
  44: '\u251C', // ├ Vertical and right
  45: '\u2524', // ┤ Vertical and left
  46: '\u2514', // └ Up and right
  47: '\u250C', // ┌ Down and right
  48: '\u2510', // ┐ Down and left
  49: '\u2518', // ┘ Up and left
  50: '\u2514', // └ Up and right (default, non-alt)
  51: '\u250C', // ┌ Down and right (default, non-alt)
  52: '\u2510', // ┐ Down and left (default, non-alt)
  53: '\u2518', // ┘ Up and left (default, non-alt)
  54: '\u2588', // █ Full block
  55: '\u2580', // ▀ Upper half block
  56: '\u2584', // ▄ Lower half block
  57: '\u258C', // ▌ Left half block
  58: '\u2590', // ▐ Right half block
  59: '\u2584', // ▄ Lower half block (default, non-alt)
  60: '\u2580', // ▀ Upper half block (default, non-alt)
  61: '\u258C', // ▌ Left half block (default, non-alt)
  62: '\u2590', // ▐ Right half block (default, non-alt)
  63: '\u259D', // ▝ Quadrant upper right
  64: '\u2597', // ▗ Quadrant lower right
  65: '\u2596', // ▖ Quadrant lower left
  66: '\u2598', // ▘ Quadrant upper left
  67: '\u259D', // ▝ Quadrant upper right (default, non-alt)
  68: '\u2597', // ▗ Quadrant lower right (default, non-alt)
  69: '\u2596', // ▖ Quadrant lower left (default, non-alt)
  70: '\u2598', // ▘ Quadrant upper left (default, non-alt)
  // 71-74: Not assigned in Bocfel (replacement character)
  75: '\u2594', // ▔ Upper one eighth block
  76: '\u2581', // ▁ Lower one eighth block
  77: '\u258F', // ▏ Left one eighth block
  78: '\u2595', // ▕ Right one eighth block
  79: ' ', // Space
  80: '\u258F', // ▏ Left one eighth block
  81: '\u258E', // ▎ Left one quarter block
  82: '\u258D', // ▍ Left three eighths block
  83: '\u258C', // ▌ Left half block
  84: '\u258B', // ▋ Left five eighths block
  85: '\u258A', // ▊ Left three quarters block
  86: '\u2589', // ▉ Left seven eighths block
  87: '\u2588', // █ Full block
  88: '\u2595', // ▕ Right one eighth block
  89: '\u258F', // ▏ Left one eighth block
  90: '\u2573', // ╳ Box drawings light diagonal cross
  91: '\u253C', // ┼ Box drawings light vertical and horizontal
  92: '\u2191', // ↑ Upwards arrow
  93: '\u2193', // ↓ Downwards arrow
  94: '\u2195', // ↕ Up down arrow
  95: '\u2395', // ⎕ APL functional symbol quad
  96: '?', // Fallback
  97: '\u16AA', // ᚪ Runic letter ac
  98: '\u16D2', // ᛒ Runic letter berkanan
  99: '\u16C7', // ᛇ Runic letter iwaz
  100: '\u16DE', // ᛞ Runic letter dagaz
  101: '\u16D6', // ᛖ Runic letter ehwaz
  102: '\u16A0', // ᚠ Runic letter fehu
  103: '\u16B7', // ᚷ Runic letter gebo
  104: '\u16BB', // ᚻ Runic letter haegl
  105: '\u16C1', // ᛁ Runic letter isaz
  106: '\u16C4', // ᛄ Runic letter ger
  107: '\u16E6', // ᛦ Runic letter long branch yr
  108: '\u16DA', // ᛚ Runic letter laguz
  109: '\u16D7', // ᛗ Runic letter mannaz
  110: '\u16BE', // ᚾ Runic letter naudiz
  111: '\u16A9', // ᚩ Runic letter os
  112: '\u15BE', // ᖾ Canadian syllabics (peorth approximation)
  113: '\u16B3', // ᚳ Runic letter cen
  114: '\u16B1', // ᚱ Runic letter raido
  115: '\u16CB', // ᛋ Runic letter sowilo
  116: '\u16CF', // ᛏ Runic letter tiwaz
  117: '\u16A2', // ᚢ Runic letter uruz
  118: '\u16E0', // ᛠ Runic letter ear
  119: '\u16B9', // ᚹ Runic letter wunjo
  120: '\u16C9', // ᛉ Runic letter algiz
  121: '\u16A5', // ᚥ Runic letter w
  122: '\u16DF', // ᛟ Runic letter othala
  123: '\u2191', // ↑ Upwards arrow
  124: '\u2193', // ↓ Downwards arrow
  125: '\u2195', // ↕ Up down arrow
  126: '?', // Fallback
};

/**
 * Unicode Box Drawing characters for Font 3 codes 128-159
 * Extended mapping for additional box drawing support
 */
const BOX_DRAWING_MAP: Record<number, string> = {
  // Primary box drawing set (used by Beyond Zork)
  128: '\u2500', // ─ Box Drawings Light Horizontal
  129: '\u2502', // │ Box Drawings Light Vertical
  130: '\u250C', // ┌ Box Drawings Light Down and Right
  131: '\u2510', // ┐ Box Drawings Light Down and Left
  132: '\u2514', // └ Box Drawings Light Up and Right
  133: '\u2518', // ┘ Box Drawings Light Up and Left
  134: '\u251C', // ├ Box Drawings Light Vertical and Right
  135: '\u2524', // ┤ Box Drawings Light Vertical and Left
  136: '\u252C', // ┬ Box Drawings Light Down and Horizontal
  137: '\u2534', // ┴ Box Drawings Light Up and Horizontal
  138: '\u253C', // ┼ Box Drawings Light Vertical and Horizontal

  // Double-line box drawing
  139: '\u2550', // ═ Box Drawings Double Horizontal
  140: '\u2551', // ║ Box Drawings Double Vertical
  141: '\u2554', // ╔ Box Drawings Double Down and Right
  142: '\u2557', // ╗ Box Drawings Double Down and Left
  143: '\u255A', // ╚ Box Drawings Double Up and Right
  144: '\u255D', // ╝ Box Drawings Double Up and Left
  145: '\u2560', // ╠ Box Drawings Double Vertical and Right
  146: '\u2563', // ╣ Box Drawings Double Vertical and Left
  147: '\u2566', // ╦ Box Drawings Double Down and Horizontal
  148: '\u2569', // ╩ Box Drawings Double Up and Horizontal
  149: '\u256C', // ╬ Box Drawings Double Vertical and Horizontal

  // Mixed single/double line connectors
  150: '\u2552', // ╒ Box Drawings Down Single and Right Double
  151: '\u2553', // ╓ Box Drawings Down Double and Right Single
  152: '\u2555', // ╕ Box Drawings Down Single and Left Double
  153: '\u2556', // ╖ Box Drawings Down Double and Left Single
  154: '\u2558', // ╘ Box Drawings Up Single and Right Double
  155: '\u2559', // ╙ Box Drawings Up Double and Right Single
  156: '\u255B', // ╛ Box Drawings Up Single and Left Double
  157: '\u255C', // ╜ Box Drawings Up Double and Left Single
  158: '\u255E', // ╞ Box Drawings Vertical Single and Right Double
  159: '\u255F', // ╟ Box Drawings Vertical Double and Right Single
};

/**
 * Unicode Arrow and Directional characters for Font 3 codes 160-175
 */
const ARROW_MAP: Record<number, string> = {
  160: '\u2191', // ↑ Upwards Arrow
  161: '\u2193', // ↓ Downwards Arrow
  162: '\u2190', // ← Leftwards Arrow
  163: '\u2192', // → Rightwards Arrow
  164: '\u2197', // ↗ North East Arrow
  165: '\u2199', // ↙ South West Arrow
  166: '\u2196', // ↖ North West Arrow
  167: '\u2198', // ↘ South East Arrow
  168: '\u2195', // ↕ Up Down Arrow
  169: '\u2194', // ↔ Left Right Arrow
  170: '\u21B5', // ↵ Downwards Arrow with Corner Leftwards (Enter)
  171: '\u21B0', // ↰ Upwards Arrow with Tip Leftwards
  172: '\u21B1', // ↱ Upwards Arrow with Tip Rightwards
  173: '\u21B2', // ↲ Downwards Arrow with Tip Leftwards
  174: '\u21B3', // ↳ Downwards Arrow with Tip Rightwards
  175: '\u2B50', // ⭐ White Medium Star (location marker)
};

/**
 * Unicode Runic characters for Font 3 codes 176-207
 * Maps to Unicode Runic block (U+16A0-U+16FF) based on Anglian futhorc
 *
 * Beyond Zork uses runic characters for magical inscriptions
 */
const RUNIC_MAP: Record<number, string> = {
  176: '\u16A0', // ᚠ Runic Letter Fehu (feoh)
  177: '\u16A2', // ᚢ Runic Letter Uruz (ur)
  178: '\u16A6', // ᚦ Runic Letter Thurisaz Thurs (thorn)
  179: '\u16A9', // ᚩ Runic Letter Os (os)
  180: '\u16B1', // ᚱ Runic Letter Raido (rad)
  181: '\u16B3', // ᚳ Runic Letter Cen (cen)
  182: '\u16B7', // ᚷ Runic Letter Gebo (gyfu)
  183: '\u16B9', // ᚹ Runic Letter Wunjo (wynn)
  184: '\u16BB', // ᚻ Runic Letter Haegl (haegl)
  185: '\u16BE', // ᚾ Runic Letter Naudiz (nyd)
  186: '\u16C1', // ᛁ Runic Letter Isaz (is)
  187: '\u16C4', // ᛄ Runic Letter Ger (ger)
  188: '\u16C7', // ᛇ Runic Letter Iwaz (eoh)
  189: '\u16C8', // ᛈ Runic Letter Pertho (peorth)
  190: '\u16CB', // ᛋ Runic Letter Sowilo (sigel)
  191: '\u16CF', // ᛏ Runic Letter Tiwaz (tir)
  192: '\u16D2', // ᛒ Runic Letter Berkanan (beorc)
  193: '\u16D6', // ᛖ Runic Letter Ehwaz (eh)
  194: '\u16D7', // ᛗ Runic Letter Mannaz (man)
  195: '\u16DA', // ᛚ Runic Letter Laguz (lagu)
  196: '\u16DD', // ᛝ Runic Letter Ingwaz (ing)
  197: '\u16DF', // ᛟ Runic Letter Othala (oe)
  198: '\u16DE', // ᛞ Runic Letter Dagaz (daeg)
  199: '\u16A0', // ᚠ Runic Letter (ac) - reuse fehu
  200: '\u16AB', // ᚫ Runic Letter Aesc (aesc)
  201: '\u16A3', // ᚣ Runic Letter Yr (yr)
  202: '\u16E1', // ᛡ Runic Letter Ior (ior)
  203: '\u16E2', // ᛢ Runic Letter Ear (ear)
  204: '\u16E3', // ᛣ Runic Letter Cweorth (cweorth)
  205: '\u16E4', // ᛤ Runic Letter Calc (calc)
  206: '\u16E6', // ᛦ Runic Letter Stan (stan)
  207: '\u16E8', // ᛨ Runic Letter Gar (gar)
};

/**
 * Unicode Special symbols for Font 3 codes 208-255
 */
const SPECIAL_MAP: Record<number, string> = {
  208: '\u25CF', // ● Black Circle
  209: '\u25CB', // ○ White Circle
  210: '\u25A0', // ■ Black Square
  211: '\u25A1', // □ White Square
  212: '\u2588', // █ Full Block
  213: '\u2584', // ▄ Lower Half Block
  214: '\u2580', // ▀ Upper Half Block
  215: '\u2591', // ░ Light Shade
  216: '\u2592', // ▒ Medium Shade
  217: '\u2593', // ▓ Dark Shade
  218: '\u25B2', // ▲ Black Up-Pointing Triangle
  219: '\u25BC', // ▼ Black Down-Pointing Triangle
  220: '\u25C4', // ◄ Black Left-Pointing Pointer
  221: '\u25BA', // ► Black Right-Pointing Pointer
  222: '\u2666', // ♦ Black Diamond Suit
  223: '\u2663', // ♣ Black Club Suit
  224: '\u2665', // ♥ Black Heart Suit
  225: '\u2660', // ♠ Black Spade Suit
  226: '\u263A', // ☺ White Smiling Face
  227: '\u263B', // ☻ Black Smiling Face
  228: '\u2639', // ☹ White Frowning Face
  229: '\u2605', // ★ Black Star
  230: '\u2606', // ☆ White Star
  231: '\u266A', // ♪ Eighth Note
  232: '\u266B', // ♫ Beamed Eighth Notes
  233: '\u263C', // ☼ White Sun with Rays
  234: '\u2640', // ♀ Female Sign
  235: '\u2642', // ♂ Male Sign
  236: '\u00A7', // § Section Sign
  237: '\u00B6', // ¶ Pilcrow Sign
  238: '\u00A9', // © Copyright Sign
  239: '\u00AE', // ® Registered Sign
  240: '\u2122', // ™ Trade Mark Sign
  241: '\u00B0', // ° Degree Sign
  242: '\u00B1', // ± Plus-Minus Sign
  243: '\u00D7', // × Multiplication Sign
  244: '\u00F7', // ÷ Division Sign
  245: '\u221E', // ∞ Infinity
  246: '\u2248', // ≈ Almost Equal To
  247: '\u2260', // ≠ Not Equal To
  248: '\u2264', // ≤ Less-Than or Equal To
  249: '\u2265', // ≥ Greater-Than or Equal To
  250: '\u00AB', // « Left-Pointing Double Angle Quotation Mark
  251: '\u00BB', // » Right-Pointing Double Angle Quotation Mark
  252: '\u2026', // … Horizontal Ellipsis
  253: '\u00A0', //   Non-Breaking Space
  254: '\u25AA', // ▪ Black Small Square
  255: '\u25AB', // ▫ White Small Square
};

/**
 * Combined Font 3 to Unicode mapping table
 */
const FONT3_UNICODE_MAP: Record<number, string> = {
  ...FONT3_PRINTABLE_MAP,
  ...BOX_DRAWING_MAP,
  ...ARROW_MAP,
  ...RUNIC_MAP,
  ...SPECIAL_MAP,
};

/**
 * Font 3 character category
 */
export type Font3Category = 'control' | 'ascii' | 'box' | 'arrow' | 'runic' | 'special';

/**
 * Convert a Font 3 character code to its Unicode equivalent
 *
 * @param code The Font 3 character code (0-255)
 * @returns The Unicode character string, or the original ASCII character if no mapping exists
 */
export function font3ToUnicode(code: number): string {
  // Check if we have a specific mapping
  if (code in FONT3_UNICODE_MAP) {
    return FONT3_UNICODE_MAP[code];
  }

  // For control characters and unmapped codes, return space
  return ' ';
}

/**
 * Convert a string of Font 3 character codes to Unicode
 *
 * @param codes Array of Font 3 character codes
 * @returns The Unicode string
 */
export function font3StringToUnicode(codes: number[]): string {
  return codes.map(font3ToUnicode).join('');
}

/**
 * Convert a text string where each character represents a Font 3 code
 *
 * @param text The text string with Font 3 encoded characters
 * @returns The Unicode string
 */
export function translateFont3Text(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    result += font3ToUnicode(code);
  }
  return result;
}

/**
 * Check if a character code has a Font 3 Unicode mapping
 *
 * @param code The character code to check
 * @returns true if the code has a specific Font 3 mapping
 */
export function hasFont3Mapping(code: number): boolean {
  return code in FONT3_UNICODE_MAP;
}

/**
 * Get the character category for a Font 3 code
 *
 * @param code The Font 3 character code
 * @returns The category name
 */
export function getFont3Category(code: number): Font3Category {
  if (code < 32) return 'control';
  if (code < 128) return 'ascii';
  if (code < 160) return 'box';
  if (code < 176) return 'arrow';
  if (code < 208) return 'runic';
  return 'special';
}

/**
 * Get all box drawing Unicode characters (for testing/debugging)
 */
export function getBoxDrawingCharacters(): Record<number, string> {
  return { ...BOX_DRAWING_MAP };
}

/**
 * Get all arrow Unicode characters (for testing/debugging)
 */
export function getArrowCharacters(): Record<number, string> {
  return { ...ARROW_MAP };
}

/**
 * Get all runic Unicode characters (for testing/debugging)
 */
export function getRunicCharacters(): Record<number, string> {
  return { ...RUNIC_MAP };
}

/**
 * Get all special Unicode characters (for testing/debugging)
 */
export function getSpecialCharacters(): Record<number, string> {
  return { ...SPECIAL_MAP };
}
