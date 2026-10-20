export function track(
  eventName: string,
  properties: Record<string, string>,
  env: { analyticsId?: string; doNotTrack?: string } = {},
) {
  if (!env.analyticsId || env.doNotTrack === "1") {
    return null;
  }
  const forbidden = ["email", "ip", "wallet"];
  for (const key of Object.keys(properties)) {
    if (forbidden.includes(key)) {
      throw new Error("analytics property is not allowed");
    }
  }
  return { eventName, properties };
}