import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProgressLogger } from '../src/progressLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ProgressLogger', () => {
  let logFilePath;
  let consoleLogSpy;

  beforeEach(() => {
    logFilePath = path.join(__dirname, 'fixtures', 'test-progress.log');
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    try {
      await fs.unlink(logFilePath);
    } catch (err) {
      // File might not exist, that's okay
    }
  });

  describe('initialization', () => {
    it('should create a progress logger with total chunks', () => {
      const logger = new ProgressLogger(10);
      expect(logger.totalChunks).toBe(10);
      expect(logger.currentChunk).toBe(0);
    });

    it('should accept optional log file path', () => {
      const logger = new ProgressLogger(10, logFilePath);
      expect(logger.logFilePath).toBe(logFilePath);
    });
  });

  describe('logProgress', () => {
    it('should log current chunk progress with percentage', async () => {
      const logger = new ProgressLogger(10);
      await logger.logProgress(0, 'header-section');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logMessage = consoleLogSpy.mock.calls[0][0];
      expect(logMessage).toContain('Chunk 1/10');
      expect(logMessage).toContain('10%');
      expect(logMessage).toContain('header-section');
    });

    it('should include timestamp in log message', async () => {
      const logger = new ProgressLogger(10);
      await logger.logProgress(0, 'header-section');

      const logMessage = consoleLogSpy.mock.calls[0][0];
      expect(logMessage).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(logMessage).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('should calculate correct percentages', async () => {
      const logger = new ProgressLogger(4);

      await logger.logProgress(0, 'header-section');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('25%');

      await logger.logProgress(1, 'paragraph-section');
      expect(consoleLogSpy.mock.calls[1][0]).toContain('50%');

      await logger.logProgress(3, 'header-section');
      expect(consoleLogSpy.mock.calls[2][0]).toContain('100%');
    });

    it('should handle optional chunk ID parameter', async () => {
      const logger = new ProgressLogger(10);
      await logger.logProgress(5, 'header-section', 'chunk-abc-123');

      const logMessage = consoleLogSpy.mock.calls[0][0];
      expect(logMessage).toContain('chunk-abc-123');
    });
  });

  describe('saveToFile', () => {
    it('should save log messages to file when path is provided', async () => {
      const logger = new ProgressLogger(5, logFilePath);

      await logger.logProgress(0, 'header-section');
      await logger.logProgress(1, 'paragraph-section');

      const logContent = await fs.readFile(logFilePath, 'utf-8');
      expect(logContent).toContain('Chunk 1/5');
      expect(logContent).toContain('Chunk 2/5');
      expect(logContent).toContain('20%');
      expect(logContent).toContain('40%');
    });

    it('should append to log file on subsequent calls', async () => {
      const logger = new ProgressLogger(3, logFilePath);

      await logger.logProgress(0, 'header-section');
      await logger.logProgress(1, 'paragraph-section');
      await logger.logProgress(2, 'header-section');

      const logContent = await fs.readFile(logFilePath, 'utf-8');
      const lines = logContent.trim().split('\n');
      expect(lines.length).toBe(3);
    });

    it('should not throw error if no log file path provided', async () => {
      const logger = new ProgressLogger(5);
      await expect(logger.logProgress(0, 'header-section')).resolves.not.toThrow();
    });

    it('should create log file if it does not exist', async () => {
      await fs.unlink(logFilePath).catch(() => {});

      const logger = new ProgressLogger(2, logFilePath);
      await logger.logProgress(0, 'header-section');

      const fileExists = await fs.access(logFilePath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });

  describe('logCompletion', () => {
    it('should log completion message', async () => {
      const logger = new ProgressLogger(10);
      await logger.logCompletion();

      expect(consoleLogSpy).toHaveBeenCalled();
      const logMessage = consoleLogSpy.mock.calls[0][0];
      expect(logMessage).toContain('Translation complete');
      expect(logMessage).toContain('10 chunks');
    });

    it('should save completion message to file if path provided', async () => {
      const logger = new ProgressLogger(5, logFilePath);
      await logger.logCompletion();

      const logContent = await fs.readFile(logFilePath, 'utf-8');
      expect(logContent).toContain('Translation complete');
      expect(logContent).toContain('5 chunks');
    });
  });

  describe('getProgress', () => {
    it('should return current progress information', () => {
      const logger = new ProgressLogger(10);
      logger.currentChunk = 3;

      const progress = logger.getProgress();
      expect(progress.current).toBe(3);
      expect(progress.total).toBe(10);
      expect(progress.percentage).toBe(30);
    });

    it('should calculate percentage correctly', () => {
      const logger = new ProgressLogger(4);
      logger.currentChunk = 1;

      let progress = logger.getProgress();
      expect(progress.percentage).toBe(25);

      logger.currentChunk = 4;
      progress = logger.getProgress();
      expect(progress.percentage).toBe(100);
    });
  });
});
