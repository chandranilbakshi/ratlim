export function createSlidWinCnt({
  windowMs,
  capacity,
  clock = () => Date.now()
}) {
  if(!Number.isFinite(windowMs) || windowMs < 0){
    throw new TypeError("windowMs should be positive finite integer");
  }
  if(!Number.isSafeInteger(capacity) || capacity < 0){
    throw new TypeError("capacity should be positive safe integer");
  }

  const catalogs = new Map();

  function consume(key){
    if(typeof key !== "string" || key.length === 0){
      throw new TypeError("key should be no empty string");
    }

    let catalog = catalogs.get(key);
    const now = clock();
    const windowStart = Math.floor(now/windowMs)*windowMs;

    if(!catalog){
      catalog = {windowStart, currentCount: 0, previousCount: 0};
      catalogs.set(key, catalog);
    }

    if(catalog.windowStart < windowStart){
      const windowsPassed = (windowStart - catalog.windowStart)/windowMs;
      if(windowsPassed === 1){
        catalog.previousCount = catalog.currentCount;
        catalog.currentCount = 0;
        catalog.windowStart = windowStart;
      }else if(windowsPassed >=2){
        catalog.previousCount = 0;
        catalog.currentCount = 0;
        catalog.windowStart = windowStart;
      }
    }

    const elapsed = now - windowStart;
    const previousWeight = 1 - elapsed/windowMs;
    const estimatedCount = catalog.currentCount + catalog.previousCount * previousWeight;

    if(estimatedCount + 1 > capacity){
      return {
        allowed: false,
        retryAfterMs:
      }
    }

    catalog.currentCount += 1;
    return {
      allowed: true,
      retryAfterMs: 0,
    }
  }

  return {consume};
}
