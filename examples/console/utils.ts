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

  return nopt(knownOpts, shorthandOpts, process.argv, 2) as ParsedArgs;
}
