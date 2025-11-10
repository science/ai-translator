import { promises as fs } from 'fs';
import path from 'path';

export class ProgressLogger {
  constructor(totalChunks, logFilePath = null) {
    this.totalChunks = totalChunks;
    this.currentChunk = 0;
    this.logFilePath = logFilePath;
  }

  async logProgress(chunkIndex, chunkType, chunkId = null) {
    this.currentChunk = chunkIndex + 1;
    const percentage = Math.round((this.currentChunk / this.totalChunks) * 100);
    const timestamp = this._getTimestamp();

    let message = `[${timestamp}] Chunk ${this.currentChunk}/${this.totalChunks} (${percentage}%) - Type: ${chunkType}`;
    if (chunkId) {
      message += ` - ID: ${chunkId}`;
    }

    console.log(message);

    if (this.logFilePath) {
      await this._saveToFile(message);
    }
  }

  async logCompletion() {
    const timestamp = this._getTimestamp();
    const message = `[${timestamp}] Translation complete! Processed ${this.totalChunks} chunks.`;

    console.log(message);

    if (this.logFilePath) {
      await this._saveToFile(message);
    }
  }

  getProgress() {
    return {
      current: this.currentChunk,
      total: this.totalChunks,
      percentage: Math.round((this.currentChunk / this.totalChunks) * 100)
    };
  }

  _getTimestamp() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    return `${date} ${time}`;
  }

  async _saveToFile(message) {
    try {
      const dir = path.dirname(this.logFilePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.appendFile(this.logFilePath, message + '\n', 'utf-8');
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }
}
