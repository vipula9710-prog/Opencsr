import { getEnv } from "../env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { StorageAdapter } from "./types";

let instance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (instance) return instance;
  const env = getEnv();
  instance =
    env.STORAGE_DRIVER === "s3"
      ? new S3Storage(env.S3_BUCKET!, {
          region: env.S3_REGION,
          endpoint: env.S3_ENDPOINT,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
        })
      : new LocalStorage(env.STORAGE_LOCAL_DIR);
  return instance;
}

export function setStorageForTests(adapter: StorageAdapter) {
  instance = adapter;
}

export type { StorageAdapter };
