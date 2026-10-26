export function createSlidWinLog({
  capacity,
  windowMs,
  cleanupInterval = 30000,
  clock = () => Date.now(),
}) {
  const catalogs = new Map();

  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new TypeError("capacity must be a positive safe integer");
  }
  if (!Number.isSafeInteger(cleanupInterval) || cleanupInterval < 0) {
    throw new TypeError("cleanupInterval must be a positive safe integer");
  }

  function consume(key){
    if (typeof key !== "string" || key.length === 0){
      throw new TypeError("key must be a non-empty string");
    }

    let catalog = catalogs.get(key);

    if(!catalog){
      catalogs.set(key, [now]);
    }

  }

  return {consume};
}
