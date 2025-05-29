import { promises as fs } from 'fs';
import path from 'path';
import { createPatch } from 'diff';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FileSnapshot {
  path: string;
  content: string;
}

interface CodeChange {
  file: string;
  diff: string;
}

export class DiffGenerator {
  /**
   * Take a snapshot of all files in a directory
   */
  async takeSnapshot(dirPath: string): Promise<FileSnapshot[]> {
    const snapshots: FileSnapshot[] = [];
    
    async function walk(dir: string) {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          if (file !== 'node_modules' && file !== '.git') {
            await walk(filePath);
          }
        } else if (stat.isFile()) {
          const content = await fs.readFile(filePath, 'utf-8');
          snapshots.push({
            path: filePath,
            content
          });
        }
      }
    }
    
    await walk(dirPath);
    return snapshots;
  }

  /**
   * Generate diff between two snapshots
   */
  generateDiff(before: FileSnapshot[], after: FileSnapshot[]): CodeChange[] {
    const changes: CodeChange[] = [];
    const afterMap = new Map(after.map(s => [s.path, s]));
    
    // Check for modified and deleted files
    for (const beforeFile of before) {
      const afterFile = afterMap.get(beforeFile.path);
      
      if (!afterFile) {
        // File was deleted
        changes.push({
          file: beforeFile.path,
          diff: createPatch(beforeFile.path, beforeFile.content, '')
        });
      } else if (beforeFile.content !== afterFile.content) {
        // File was modified
        changes.push({
          file: beforeFile.path,
          diff: createPatch(beforeFile.path, beforeFile.content, afterFile.content)
        });
      }
    }
    
    // Check for new files
    for (const afterFile of after) {
      if (!before.find(b => b.path === afterFile.path)) {
        changes.push({
          file: afterFile.path,
          diff: createPatch(afterFile.path, '', afterFile.content)
        });
      }
    }
    
    return changes;
  }

  /**
   * Save snapshots to disk
   */
  async saveSnapshot(snapshots: FileSnapshot[], outputPath: string): Promise<void> {
    await fs.mkdir(outputPath, { recursive: true });
    
    for (const snapshot of snapshots) {
      const filePath = path.join(outputPath, snapshot.path);
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, snapshot.content, 'utf-8');
    }
  }

  /**
   * Load snapshot from disk
   */
  async loadSnapshot(snapshotPath: string): Promise<FileSnapshot[]> {
    const snapshots: FileSnapshot[] = [];
    
    const files = await fs.readdir(snapshotPath);

    for (const file of files) {
      const filePath = path.join(snapshotPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      snapshots.push({
        path: file,
        content
      });
    }

    return snapshots;
  }
} 