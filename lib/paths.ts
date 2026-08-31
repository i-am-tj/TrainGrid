import path from "path";

export function getDataDir(): string {
  return process.env.TRAINGRID_DATA_DIR || path.join(process.cwd(), "data");
}

export function getTemplatesDir(): string {
  return path.join(getDataDir(), "templates");
}

export function getSchedulePath(): string {
  return path.join(getDataDir(), "schedule.json");
}
