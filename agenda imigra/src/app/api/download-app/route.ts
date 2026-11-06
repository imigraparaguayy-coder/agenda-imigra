import { ZipArchive } from "archiver";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".turbo"]);
const EXCLUDE_FILES = new Set([".env", "next-env.d.ts", "tsconfig.tsbuildinfo"]);

function collect(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      results.push(...collect(path.join(dir, entry.name)));
    } else if (!EXCLUDE_FILES.has(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

export async function GET() {
  try {
    const root = process.cwd();
    const archive = new ZipArchive({ zlib: { level: 9 } });
    for (const file of collect(root)) {
      archive.file(file, { name: path.relative(root, file).split(path.sep).join("/") });
    }
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      archive.on("data", (c: Buffer) => chunks.push(c));
      archive.on("end", () => resolve());
      archive.on("error", reject);
      archive.finalize();
    });
    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="agenda-do-imigra.zip"',
      },
    });
  } catch (error) {
    console.error("download-app falhou:", error);
    return Response.json({ error: "Não foi possível gerar o arquivo ZIP." }, { status: 500 });
  }
}
