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

    const now = clock();

    if(!catalog){
      catalog = [];
      catalogs.set(key, catalog);
    }

    if(catalog.length !== 0){
      catalog = catalog.filter((timestamp) => timestamp > now - windowMs);
    }
    catalogs.set(key, catalog);

    if(catalog.length === capacity){
      return {
        allowed: false,
        retryAfterMs: Math.ceil(catalog[0] + windowMs - now),
      }
    }
    catalog.push(now);
    return {
      allowed: true,
      retryAfterMs: 0,
    }
  }

  function cleanup(){
    const now = clock();
    for(const [key, catalog] of catalogs){
      if(catalog.at(-1) <= now - windowMs){
        catalogs.delete(key);
      }
    }
  }

  const cleanupTimer = cleanupInterval > 0 ? setInterval(cleanup, cleanupInterval) : null;

  function close(){
    if(cleanupTimer!==null){
      clearInterval(cleanupTimer);
    }
  }

  return {consume, close};
}
