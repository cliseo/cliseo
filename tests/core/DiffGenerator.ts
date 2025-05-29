import { createTwoFilesPatch } from 'diff';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

interface FileSnapshot {
  [filepath: string]: string;
}

interface CodeChange {
  file: string;
  diff: string;
}

export class DiffGenerator {
  /**
   * Take a snapshot of all files in a directory
   */
  async takeSnapshot(dirPath: string): Promise<FileSnapshot> {
    const snapshot: FileSnapshot = {};
    
    // Find all relevant files
    const files = await glob('**/*.{js,jsx,ts,tsx,vue,html,css}', {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    // Read each file
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        snapshot[file] = content;
      } catch (error) {
        console.warn(`Failed to read file ${file}: ${error.message}`);
      }
    }

    return snapshot;
  }

  /**
   * Generate diff between two snapshots
   */
  generateDiff(before: FileSnapshot, after: FileSnapshot): CodeChange[] {
    const changes: CodeChange[] = [];

    // Find all unique file paths
    const allFiles = new Set([
      ...Object.keys(before),
      ...Object.keys(after)
    ]);

    // Generate diff for each file
    for (const file of allFiles) {
      const beforeContent = before[file] || '';
      const afterContent = after[file] || '';

      // Skip if file hasn't changed
      if (beforeContent === afterContent) {
        continue;
      }

      // Generate unified diff
      const diff = createTwoFilesPatch(
        file,
        file,
        beforeContent,
        afterContent,
        'Before',
        'After'
      );

      changes.push({
        file,
        diff
      });
    }

    return changes;
  }

  /**
   * Save snapshots to disk
   */
  async saveSnapshot(snapshot: FileSnapshot, outputPath: string): Promise<void> {
    await fs.mkdir(outputPath, { recursive: true });
    
    for (const [file, content] of Object.entries(snapshot)) {
      const filePath = path.join(outputPath, file);
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  /**
   * Load snapshot from disk
   */
  async loadSnapshot(snapshotPath: string): Promise<FileSnapshot> {
    const snapshot: FileSnapshot = {};
    
    const files = await glob('**/*.{js,jsx,ts,tsx,vue,html,css}', {
      cwd: snapshotPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    for (const file of files) {
      const fullPath = path.join(snapshotPath, file);
      const content = await fs.readFile(fullPath, 'utf-8');
      snapshot[file] = content;
    }

    return snapshot;
  }
} 