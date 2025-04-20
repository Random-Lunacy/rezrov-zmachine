import * as fs from 'fs';
import nopt from 'nopt';
import StdioScreen from './StdioScreen';

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

const file = parsed.argv.remain[0];

if (!file) {
  console.error('must specify path to z-machine story file');
  process.exit(0);
}

const storyData = fs.readFileSync(file);

const screen = new StdioScreen();

const storage = {
  saveSnapshot(game: Game) {
    fs.writeFileSync('snapshot.dat', game.snapshotToBuffer(), {
      encoding: 'binary',
    });
  },

  loadSnapshot(_game: Game) {
    const f = fs.readFileSync('snapshot.dat');
    return Game.readSnapshotFromBuffer(Buffer.from(f.buffer));
  },
};

const game = new Game(storyData, screen, storage);

if (parsed.header) {
  dumpHeader(game);
}

if (parsed.objectTree) {
  dumpObjectTable(game);
}

if (parsed.dict) {
  dumpDictionary(game);
}

if (!parsed.noExec) {
  game.execute();
}
