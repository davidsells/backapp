import fs from 'fs';
import path from 'path';

/**
 * Calculate total size and file count for given sources
 */
export class SizeCalculator {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Calculate size for multiple sources
   * @param {Array} sources - Array of source objects with path property
   * @returns {Promise<{totalBytes: number, totalFiles: number}>}
   */
  async calculateSize(sources) {
    let totalBytes = 0;
    let totalFiles = 0;

    for (const source of sources) {
      try {
        const result = await this.calculateDirectorySize(source.path);
        totalBytes += result.bytes;
        totalFiles += result.files;
      } catch (error) {
        this.logger.warn(`Failed to calculate size for ${source.path}: ${error.message}`);
        // Continue with other sources
      }
    }

    return { totalBytes, totalFiles };
  }

  /**
   * Calculate size of a single directory recursively
   * @param {string} dirPath - Path to directory
   * @returns {Promise<{bytes: number, files: number}>}
   */
  async calculateDirectorySize(dirPath) {
    let totalBytes = 0;
    let totalFiles = 0;

    const walk = async (currentPath) => {
      try {
        const stats = fs.statSync(currentPath);

        if (stats.isFile()) {
          totalBytes += stats.size;
          totalFiles++;
        } else if (stats.isDirectory()) {
          const entries = fs.readdirSync(currentPath);
          for (const entry of entries) {
            // Skip common exclusions (same as backup exclusions)
            if (entry === 'node_modules' || entry === '.git' || entry.endsWith('.log')) {
              continue;
            }
            await walk(path.join(currentPath, entry));
          }
        }
      } catch (error) {
        // Skip files/dirs we can't access
        this.logger.debug(`Skipping ${currentPath}: ${error.message}`);
      }
    };

    await walk(dirPath);
    return { bytes: totalBytes, files: totalFiles };
  }
}
