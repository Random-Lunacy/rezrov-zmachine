import nopt from 'nopt';

export interface ParsedArgs {
  debug: boolean;
  noExec: boolean;
  header: boolean;
  objectTree: boolean;
  dict: boolean;
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
  };

  const shorthandOpts = {
    d: ['--debug'],
    n: ['--noExec'],
    h: ['--header'],
    o: ['--objectTree'],
    t: ['--dict'],
    dump: ['--header', '--objectTree', '--dict', '-n'],
  };

  const parsed = nopt(knownOpts, shorthandOpts, process.argv, 2);

  // Ensure all required properties exist with proper defaults
  return {
    debug: Boolean(parsed.debug),
    noExec: Boolean(parsed.noExec),
    header: Boolean(parsed.header),
    objectTree: Boolean(parsed.objectTree),
    dict: Boolean(parsed.dict),
    argv: {
      remain: parsed.argv?.remain || []
    }
  };
}
