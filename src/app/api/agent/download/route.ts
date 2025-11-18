import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import archiver from 'archiver';
import path from 'path';
import { readdir, stat } from 'fs/promises';

/**
 * Download BackApp agent as a zip file
 */
export async function GET(_request: NextRequest) {
  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Set up response headers for file download
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', 'attachment; filename="backapp-agent.zip"');

    // Path to agent directory
    const agentDir = path.join(process.cwd(), 'agent');

    // Files/folders to exclude
    const excludes = ['node_modules', 'config.json', '.git', '*.log', '*.tar.gz'];

    // Add files to archive
    const addToArchive = async (dir: string, prefix: string = '') => {
      const entries = await readdir(dir);

      for (const entry of entries) {
        // Skip excluded files/folders
        if (excludes.some((pattern) => {
          if (pattern.includes('*')) {
            return entry.endsWith(pattern.replace('*', ''));
          }
          return entry === pattern;
        })) {
          continue;
        }

        const fullPath = path.join(dir, entry);
        const archivePath = path.join(prefix, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          await addToArchive(fullPath, archivePath);
        } else if (stats.isFile()) {
          archive.file(fullPath, { name: archivePath });
        }
      }
    };

    await addToArchive(agentDir, 'backapp-agent');

    // Finalize the archive
    archive.finalize();

    // Create a ReadableStream from the archive
    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        archive.on('end', () => {
          controller.close();
        });

        archive.on('error', (err) => {
          controller.error(err);
        });
      },
    });

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error('Agent download error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download agent',
      },
      { status: 500 }
    );
  }
}
