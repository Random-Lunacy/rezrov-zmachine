import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameOpcodes } from '../../../../src/core/opcodes/game';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { OperandType } from '../../../../src/types';
import { HeaderLocation } from '../../../../src/utils/constants';
import { MockZMachine, createMockZMachine } from '../../../mocks';

describe('Game Opcodes', () => {
  let mockZMachine: MockZMachine;

  beforeEach(() => {
    mockZMachine = createMockZMachine();
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('save_undo', () => {
    it('should call saveUndo and store result in the specified variable', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'saveUndo').mockReturnValue(true);
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      await gameOpcodes.save_undo.impl(mockZMachine as unknown as ZMachine, []);

      expect(mockZMachine.saveUndo).toHaveBeenCalled();
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 1);
    });

    it('should store 0 in the variable when saveUndo fails', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'saveUndo').mockReturnValue(false);
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      await gameOpcodes.save_undo.impl(mockZMachine as unknown as ZMachine, []);

      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });

    it('should handle exceptions and store 0 on error', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'saveUndo').mockImplementation(() => {
        throw new Error('Test error');
      });
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');
      const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

      await gameOpcodes.save_undo.impl(mockZMachine as unknown as ZMachine, []);

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save undo state'));
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });
  });

  describe('restore_undo', () => {
    it('should call restoreUndo and store result in the specified variable', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'restoreUndo').mockReturnValue(true);
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      await gameOpcodes.restore_undo.impl(mockZMachine as unknown as ZMachine, []);

      expect(mockZMachine.restoreUndo).toHaveBeenCalled();
      // Should store 2 on successful restore (per Z-Machine spec)
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 2);
    });

    it('should store 0 in the variable when restoreUndo fails', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'restoreUndo').mockReturnValue(false);
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      await gameOpcodes.restore_undo.impl(mockZMachine as unknown as ZMachine, []);

      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });

    it('should handle exceptions and store 0 on error', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'restoreUndo').mockImplementation(() => {
        throw new Error('Test error');
      });
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');
      const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

      await gameOpcodes.restore_undo.impl(mockZMachine as unknown as ZMachine, []);

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to restore undo state'));
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });
  });

  describe('restart', () => {
    it('should call the machine restart method', () => {
      const restartSpy = vi.spyOn(mockZMachine, 'restart').mockImplementation(() => {});

      gameOpcodes.restart.impl(mockZMachine as unknown as ZMachine, []);

      expect(restartSpy).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    function createStoryBuffer(version: number): Buffer {
      // Create a minimal story buffer with a valid checksum
      const buf = Buffer.alloc(256);
      buf[0] = version;

      // File length at 0x1A (packed: divide by 2 for V3)
      const fileLength = 256;
      buf.writeUInt16BE(version <= 3 ? fileLength / 2 : fileLength / 4, HeaderLocation.FileLength);

      // Compute checksum: sum bytes from offset 64 to end
      let checksum = 0;
      for (let i = 64; i < fileLength; i++) {
        checksum = (checksum + buf[i]) & 0xffff;
      }
      buf.writeUInt16BE(checksum, HeaderLocation.Checksum);

      return buf;
    }

    it('should branch true when checksum matches', () => {
      const storyBuffer = createStoryBuffer(3);
      mockZMachine.originalStory = storyBuffer;
      vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(3);
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
      const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

      gameOpcodes.verify.impl(mockZMachine as unknown as ZMachine, []);

      expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
    });

    it('should branch false when checksum does not match', () => {
      const storyBuffer = createStoryBuffer(3);
      // Corrupt a byte to break the checksum
      storyBuffer[100] = (storyBuffer[100] + 1) & 0xff;
      mockZMachine.originalStory = storyBuffer;
      vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(3);
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
      const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

      gameOpcodes.verify.impl(mockZMachine as unknown as ZMachine, []);

      expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
    });

    it('should handle V5 file length packing (multiply by 4)', () => {
      const storyBuffer = createStoryBuffer(5);
      mockZMachine.originalStory = storyBuffer;
      vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(5);
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
      const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

      gameOpcodes.verify.impl(mockZMachine as unknown as ZMachine, []);

      expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
    });

    it('should compute checksum correctly with non-zero data', () => {
      const buf = Buffer.alloc(128);
      buf[0] = 3; // Version 3
      buf.writeUInt16BE(128 / 2, HeaderLocation.FileLength);

      // Fill data region with non-zero bytes
      for (let i = 64; i < 128; i++) {
        buf[i] = i & 0xff;
      }

      // Compute expected checksum
      let expectedChecksum = 0;
      for (let i = 64; i < 128; i++) {
        expectedChecksum = (expectedChecksum + buf[i]) & 0xffff;
      }
      buf.writeUInt16BE(expectedChecksum, HeaderLocation.Checksum);

      mockZMachine.originalStory = buf;
      vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(3);
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
      const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

      gameOpcodes.verify.impl(mockZMachine as unknown as ZMachine, []);

      expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
    });
  });

  describe('piracy', () => {
    it('should always branch as if the game is genuine', () => {
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
      const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

      gameOpcodes.piracy.impl(mockZMachine as unknown as ZMachine, []);

      // Piracy check should always indicate the game is genuine
      expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
    });
  });

  describe('save', () => {
    describe('V5+ standard save (no operands)', () => {
      beforeEach(() => {
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(5);
      });

      it('should call saveGame and store 1 on success', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveGame').mockResolvedValue(true);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        // Empty operandTypes = standard save
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, []);

        expect(mockZMachine.saveGame).toHaveBeenCalled();
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 1);
      });

      it('should store 0 on save failure', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveGame').mockResolvedValue(false);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, []);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should handle exception in saveGame', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveGame').mockRejectedValue(new Error('Test error'));
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, []);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });
    });

    describe('V5+ partial save (with operands)', () => {
      beforeEach(() => {
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(5);
      });

      it('should call saveAuxiliary with table, bytes, name args', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveAuxiliary').mockResolvedValue(true);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        // Operands present = partial save
        const operandTypes = [OperandType.Large, OperandType.Large, OperandType.Large];
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64, 0x2000);

        expect(mockZMachine.saveAuxiliary).toHaveBeenCalledWith(0x1000, 64, 0x2000, true);
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 1);
      });

      it('should store 0 on partial save failure', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveAuxiliary').mockResolvedValue(false);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        const operandTypes = [OperandType.Large, OperandType.Large];
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should respect the prompt parameter', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        const saveAuxSpy = vi.spyOn(mockZMachine, 'saveAuxiliary').mockResolvedValue(true);

        // prompt = 0 (don't prompt)
        const operandTypes = [OperandType.Large, OperandType.Large, OperandType.Large, OperandType.Small];
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64, 0, 0);
        expect(saveAuxSpy).toHaveBeenCalledWith(0x1000, 64, 0, false);

        saveAuxSpy.mockClear();

        // prompt = 1 (do prompt)
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64, 0, 1);
        expect(saveAuxSpy).toHaveBeenCalledWith(0x1000, 64, 0, true);
      });

      it('should handle exception in saveAuxiliary', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveAuxiliary').mockRejectedValue(new Error('Test error'));
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        const operandTypes = [OperandType.Large, OperandType.Large];
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });
    });

    describe('V3 save (branch-based)', () => {
      beforeEach(() => {
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(3);
      });

      it('should call saveGame and branch on result', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'saveGame').mockResolvedValue(true);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, [], 0, 0);

        expect(mockZMachine.saveGame).toHaveBeenCalled();
        expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
      });

      it('should handle save failure', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'saveGame').mockResolvedValue(false);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, [], 0, 0);

        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });

      it('should handle exception in saveGame', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'saveGame').mockRejectedValue(new Error('Test error'));
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, [], 0, 0);

        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });
    });
  });

  describe('restore', () => {
    describe('V5+ standard restore (no operands)', () => {
      beforeEach(() => {
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(5);
      });

      it('should call restoreGame and store 2 on success', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreGame').mockResolvedValue(true);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, []);

        expect(mockZMachine.restoreGame).toHaveBeenCalled();
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 2);
      });

      it('should store 0 on restore failure', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreGame').mockResolvedValue(false);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, []);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should handle exception in restoreGame', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreGame').mockRejectedValue(new Error('Test error'));
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, []);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });
    });

    describe('V5+ partial restore (with operands)', () => {
      beforeEach(() => {
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(5);
      });

      it('should call restoreAuxiliary and store bytes read', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreAuxiliary').mockResolvedValue(64);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        const operandTypes = [OperandType.Large, OperandType.Large, OperandType.Large];
        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64, 0x2000);

        expect(mockZMachine.restoreAuxiliary).toHaveBeenCalledWith(0x1000, 64, 0x2000, true);
        // Partial restore returns actual bytes read, not 2
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 64);
      });

      it('should store 0 on partial restore failure', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreAuxiliary').mockResolvedValue(0);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        const operandTypes = [OperandType.Large, OperandType.Large];
        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should respect the prompt parameter', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        const restoreAuxSpy = vi.spyOn(mockZMachine, 'restoreAuxiliary').mockResolvedValue(64);

        const operandTypes = [OperandType.Large, OperandType.Large, OperandType.Large, OperandType.Small];

        // prompt = 0 (don't prompt)
        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64, 0, 0);
        expect(restoreAuxSpy).toHaveBeenCalledWith(0x1000, 64, 0, false);

        restoreAuxSpy.mockClear();

        // prompt = 1 (do prompt)
        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64, 0, 1);
        expect(restoreAuxSpy).toHaveBeenCalledWith(0x1000, 64, 0, true);
      });

      it('should handle exception in restoreAuxiliary', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreAuxiliary').mockRejectedValue(new Error('Test error'));
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        const operandTypes = [OperandType.Large, OperandType.Large];
        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, operandTypes, 0x1000, 64);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });
    });

    describe('V3 restore (branch-based)', () => {
      beforeEach(() => {
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(3);
      });

      it('should call restoreGame and branch on result', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'restoreGame').mockResolvedValue(true);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, [], 0, 0);

        expect(mockZMachine.restoreGame).toHaveBeenCalled();
        expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
      });

      it('should handle restore failure', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'restoreGame').mockResolvedValue(false);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, [], 0, 0);

        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });

      it('should handle exception in restoreGame', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'restoreGame').mockRejectedValue(new Error('Test error'));
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, [], 0, 0);

        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });
    });
  });

  describe('quit', () => {
    it('should call the machine quit method', () => {
      const quitSpy = vi.spyOn(mockZMachine, 'quit').mockImplementation(() => {});

      gameOpcodes.quit.impl(mockZMachine as unknown as ZMachine, []);

      expect(quitSpy).toHaveBeenCalled();
    });
  });

  describe('show_status', () => {
    it('should call the update status bar method', () => {
      const updateStatusBarSpy = vi.spyOn(mockZMachine, 'updateStatusBar').mockImplementation(() => {});

      gameOpcodes.show_status.impl(mockZMachine as unknown as ZMachine, []);

      expect(updateStatusBarSpy).toHaveBeenCalled();
    });
  });
});
