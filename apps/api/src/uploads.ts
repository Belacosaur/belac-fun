export type UploadEnv = {
  R2_BUCKET?: string;
  R2_ACCOUNT_ID?: string;
};

export function uploadIntent(env: UploadEnv, objectKey: string, sign: (key: string) => string | null) {
  if (!env.R2_BUCKET || !env.R2_ACCOUNT_ID) {
    return { status: 501 as const, error: "Uploads are unavailable" };
  }
  const url = sign(objectKey);
  if (!url) {
    return { status: 501 as const, error: "Uploads are unavailable" };
  }
  return { status: 200 as const, url, key: objectKey };
}
