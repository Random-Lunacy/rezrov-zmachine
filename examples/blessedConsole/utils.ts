// @ts-expect-error No types available for nopt
import nopt from 'nopt';

/**
 * Interpreter names mapped to their Z-machine header values.
 * Games like Beyond Zork use this to select color palettes.
 */
export const INTERPRETER_NAMES: Record<string, number> = {
  dec20: 1,
  'apple-iie': 2,
  mac: 3,
  amiga: 4,
  atari: 5,
  ibm: 6,
  c128: 7,
  c64: 8,
  'apple-iic': 9,
  'apple-iigs': 10,
  tandy: 11,
};

export interface ParsedArgs {
  debug: boolean;
  noExec: boolean;
  header: boolean;
  objectTree: boolean;
  dict: boolean;
  interpreter: string | null;
  argv: {
    remain: string[];
  };
}

export function parseArguments(): ParsedArgs {
  const knownOpts = {
    debug: Boolean,
    noExec: Boolean,
    header: Boolean,
    objectTree: Boolean,
    dict: Boolean,
    interpreter: String,
  };

  const shorthandOpts = {
    d: ['--debug'],
    n: ['--noExec'],
    h: ['--header'],
    o: ['--objectTree'],
    t: ['--dict'],
    i: ['--interpreter'],
    dump: ['--header', '--objectTree', '--dict', '-n'],
  };

  const parsed = nopt(knownOpts, shorthandOpts, process.argv, 2);

  // Validate interpreter name if provided
  const interpreter = parsed.interpreter ? String(parsed.interpreter).toLowerCase() : null;
  if (interpreter && !INTERPRETER_NAMES[interpreter]) {
    const validNames = Object.keys(INTERPRETER_NAMES).join(', ');
    // eslint-disable-next-line no-console
    console.error(`Unknown interpreter: "${parsed.interpreter}". Valid options: ${validNames}`);
    process.exit(1);
  }

  // Ensure all required properties exist with proper defaults
  return {
    debug: Boolean(parsed.debug),
    noExec: Boolean(parsed.noExec),
    header: Boolean(parsed.header),
    objectTree: Boolean(parsed.objectTree),
    dict: Boolean(parsed.dict),
    interpreter,
    argv: {
      remain: parsed.argv?.remain || [],
    },
  };
}
