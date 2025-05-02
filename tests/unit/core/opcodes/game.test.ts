import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameOpcodes } from '../../../../src/core/opcodes/game';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
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
      // Mock the readByte method to return a variable number
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);

      // Mock the saveUndo method to return true (success)
      vi.spyOn(mockZMachine, 'saveUndo').mockReturnValue(true);

      // Spy on storeVariable to check if it's called correctly
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      // Call the opcode
      await gameOpcodes.save_undo.impl(mockZMachine as unknown as ZMachine);

      // Verify that saveUndo was called
      expect(mockZMachine.saveUndo).toHaveBeenCalled();

      // Verify that the result was stored in variable 5 with value 1 (success)
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 1);
    });

    it('should store 0 in the variable when saveUndo fails', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'saveUndo').mockReturnValue(false);
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      await gameOpcodes.save_undo.impl(mockZMachine as unknown as ZMachine);

      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });

    it('should handle exceptions and store 0 on error', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'saveUndo').mockImplementation(() => {
        throw new Error('Test error');
      });
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');
      const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

      await gameOpcodes.save_undo.impl(mockZMachine as unknown as ZMachine);

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save undo state'));
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });
  });

  describe('restore_undo', () => {
    it('should call restoreUndo and store result in the specified variable', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'restoreUndo').mockReturnValue(true);
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      await gameOpcodes.restore_undo.impl(mockZMachine as unknown as ZMachine);

      expect(mockZMachine.restoreUndo).toHaveBeenCalled();
      // Should store 2 on successful restore (per Z-Machine spec)
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 2);
    });

    it('should store 0 in the variable when restoreUndo fails', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'restoreUndo').mockReturnValue(false);
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

      await gameOpcodes.restore_undo.impl(mockZMachine as unknown as ZMachine);

      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });

    it('should handle exceptions and store 0 on error', async () => {
      vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
      vi.spyOn(mockZMachine, 'restoreUndo').mockImplementation(() => {
        throw new Error('Test error');
      });
      const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');
      const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

      await gameOpcodes.restore_undo.impl(mockZMachine as unknown as ZMachine);

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to restore undo state'));
      expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
    });
  });

  describe('restart', () => {
    it('should call the machine restart method', () => {
      const restartSpy = vi.spyOn(mockZMachine, 'restart').mockImplementation(() => {});

      gameOpcodes.restart.impl(mockZMachine as unknown as ZMachine);

      expect(restartSpy).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should branch if verification succeeds', () => {
      // Mock the branch offset reading
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);

      // Spy on doBranch to check if it's called correctly
      const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

      gameOpcodes.verify.impl(mockZMachine as unknown as ZMachine);

      // Verify that doBranch was called with the expected parameters
      // If verification succeeds, it should pass true, branchOnFalse=false, offset=10
      expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
    });

    it('should handle verification errors', () => {
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);

      // Mock an error in verification process (would be in the real implementation)
      vi.spyOn(mockZMachine.state, 'doBranch').mockImplementation(() => {
        throw new Error('Test verification error');
      });

      const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

      expect(() => gameOpcodes.verify.impl(mockZMachine as unknown as ZMachine)).toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error verifying checksum'));
    });
  });

  describe('piracy', () => {
    it('should always branch as if the game is genuine', () => {
      vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
      const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

      gameOpcodes.piracy.impl(mockZMachine as unknown as ZMachine);

      // Piracy check should always indicate the game is genuine
      expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
    });
  });

  describe('save', () => {
    describe('for version 5+', () => {
      beforeEach(() => {
        // Set version to 5 for these tests
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(5);
      });

      it('should call saveToTable and store result in variable for v5+', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveToTable').mockResolvedValue(true);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 100, 200, 0);

        expect(mockZMachine.saveToTable).toHaveBeenCalledWith(100, 200, 0, true);
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 1);
      });

      it('should handle save failure for v5+', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveToTable').mockResolvedValue(false);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 100, 200, 0);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should handle exception in saveToTable for v5+', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'saveToTable').mockRejectedValue(new Error('Test error'));
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');
        const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 100, 200, 0);

        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save'));
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should respect the prompt parameter', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        const saveToTableSpy = vi.spyOn(mockZMachine, 'saveToTable').mockResolvedValue(true);

        // Test with prompt = 0 (don't prompt)
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 100, 200, 0, 0);
        expect(saveToTableSpy).toHaveBeenCalledWith(100, 200, 0, false);

        // Reset spy
        saveToTableSpy.mockClear();

        // Test with prompt = 1 (do prompt)
        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 100, 200, 0, 1);
        expect(saveToTableSpy).toHaveBeenCalledWith(100, 200, 0, true);
      });
    });

    describe('for versions < 5', () => {
      beforeEach(() => {
        // Set version to 3 for these tests
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(3);
      });

      it('should call saveGame and branch on result for v3', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'saveGame').mockResolvedValue(true);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 0, 0);

        expect(mockZMachine.saveGame).toHaveBeenCalled();
        expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
      });

      it('should handle save failure for v3', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'saveGame').mockResolvedValue(false);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 0, 0);

        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });

      it('should handle exception in saveGame for v3', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'saveGame').mockRejectedValue(new Error('Test error'));
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');
        const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

        await gameOpcodes.save.impl(mockZMachine as unknown as ZMachine, 0, 0);

        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save game'));
        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });
    });
  });

  describe('restore', () => {
    describe('for version 5+', () => {
      beforeEach(() => {
        // Set version to 5 for these tests
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(5);
      });

      it('should call restoreFromTable and store result in variable for v5+', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreFromTable').mockResolvedValue(true);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 100, 200, 0);

        expect(mockZMachine.restoreFromTable).toHaveBeenCalledWith(100, 200, 0, true);
        // Should store 2 on successful restore
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 2);
      });

      it('should handle restore failure for v5+', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreFromTable').mockResolvedValue(false);
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 100, 200, 0);

        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should handle exception in restoreFromTable for v5+', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        vi.spyOn(mockZMachine, 'restoreFromTable').mockRejectedValue(new Error('Test error'));
        const storeVariableSpy = vi.spyOn(mockZMachine.state, 'storeVariable');
        const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 100, 200, 0);

        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to restore'));
        expect(storeVariableSpy).toHaveBeenCalledWith(5, 0);
      });

      it('should respect the prompt parameter', async () => {
        vi.spyOn(mockZMachine.state, 'readByte').mockReturnValue(5);
        const restoreFromTableSpy = vi.spyOn(mockZMachine, 'restoreFromTable').mockResolvedValue(true);

        // Test with prompt = 0 (don't prompt)
        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 100, 200, 0, 0);
        expect(restoreFromTableSpy).toHaveBeenCalledWith(100, 200, 0, false);

        // Reset spy
        restoreFromTableSpy.mockClear();

        // Test with prompt = 1 (do prompt)
        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 100, 200, 0, 1);
        expect(restoreFromTableSpy).toHaveBeenCalledWith(100, 200, 0, true);
      });
    });

    describe('for versions < 5', () => {
      beforeEach(() => {
        // Set version to 3 for these tests
        vi.spyOn(mockZMachine.state, 'version', 'get').mockReturnValue(3);
      });

      it('should call restoreGame and branch on result for v3', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'restoreGame').mockResolvedValue(true);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 0, 0);

        expect(mockZMachine.restoreGame).toHaveBeenCalled();
        expect(doBranchSpy).toHaveBeenCalledWith(true, false, 10);
      });

      it('should handle restore failure for v3', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'restoreGame').mockResolvedValue(false);
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 0, 0);

        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });

      it('should handle exception in restoreGame for v3', async () => {
        vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([10, false]);
        vi.spyOn(mockZMachine, 'restoreGame').mockRejectedValue(new Error('Test error'));
        const doBranchSpy = vi.spyOn(mockZMachine.state, 'doBranch');
        const loggerErrorSpy = vi.spyOn(mockZMachine.logger, 'error');

        await gameOpcodes.restore.impl(mockZMachine as unknown as ZMachine, 0, 0);

        expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to restore game'));
        expect(doBranchSpy).toHaveBeenCalledWith(false, false, 10);
      });
    });
  });

  describe('quit', () => {
    it('should call the machine quit method', () => {
      const quitSpy = vi.spyOn(mockZMachine, 'quit').mockImplementation(() => {});

      gameOpcodes.quit.impl(mockZMachine as unknown as ZMachine);

      expect(quitSpy).toHaveBeenCalled();
    });
  });

  describe('show_status', () => {
    it('should call the update status bar method', () => {
      const updateStatusBarSpy = vi.spyOn(mockZMachine.state, 'updateStatusBar').mockImplementation(() => {});

      gameOpcodes.show_status.impl(mockZMachine as unknown as ZMachine);

      expect(updateStatusBarSpy).toHaveBeenCalled();
    });
  });
});
