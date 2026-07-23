const STORAGE_KEY = "va_device_id";

/**
 * A stable per-browser identifier for anonymous (not-logged-in) visitors,
 * used as `user_identifier` on click/search events so the per-minute dedupe
 * constraint in schema.sql works the same for anonymous and staff users.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function minuteBucket(date = new Date()): string {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d.toISOString();
}
