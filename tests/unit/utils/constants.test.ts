import { describe, expect, it } from 'vitest';
import { Flags2 } from '../../../src/utils/constants';

describe('Flags2', () => {
  it('should map each flag to its bit in the Z-machine spec §11.1 header table', () => {
    const expectedBits: Record<string, number> = {
      Transcribing: 0,
      ForcedFixedFont: 1,
      RequestScreenRedraw: 2,
      WantsPictures: 3,
      WantsUndo: 4,
      WantsMouse: 5,
      WantsColors: 6,
      WantsSound: 7,
      WantsMenus: 8,
    };

    for (const [name, bit] of Object.entries(expectedBits)) {
      expect(Flags2[name as keyof typeof Flags2], name).toBe(1 << bit);
    }
  });

  it('should decode the Flags2 word shipped in Zork Zero (0x78)', () => {
    const flags2 = 0x78;

    expect(flags2 & Flags2.WantsPictures).not.toBe(0);
    expect(flags2 & Flags2.WantsUndo).not.toBe(0);
    expect(flags2 & Flags2.WantsMouse).not.toBe(0);
    expect(flags2 & Flags2.WantsColors).not.toBe(0);
    expect(flags2 & Flags2.WantsSound).toBe(0);
  });
});
