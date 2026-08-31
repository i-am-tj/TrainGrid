import { mkdir, rename, writeFile } from "fs/promises";
import path from "path";

export async function writeAtomic(filePath: string, contents: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, filePath);
}
