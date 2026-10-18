export function createTokenBucket({
  capacity,
  refillRate,
  clock = () => Date.now(),
  cleanupInterval = 30000,
}) {
  const buckets = new Map();

  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new TypeError("capacity must be a positive safe integer");
  }
  if (!Number.isSafeInteger(cleanupInterval) || cleanupInterval < 0) {
    throw new TypeError("cleanupInterval must be a positive safe integer");
  }
  if (!Number.isFinite(refillRate) || refillRate <= 0) {
    throw new TypeError("refillRate must be a positive finite number");
  }

  function consume(key){
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("key must be a non-empty string");
    }

    const now = clock();

    let bucket = buckets.get(key);
    let userTokens;
    let userLastRefill;

    if(!bucket){
      userTokens = capacity;
      userLastRefill = now;
    } else{
      userTokens = bucket.tokens;
      userLastRefill = bucket.lastRefillAt;
    }

    const elapsed = now - userLastRefill;
    const tokens = Math.min(capacity, userTokens+(elapsed/1000)*refillRate);

    if(tokens>=1){
      buckets.set(key, {tokens: tokens-1, lastRefillAt: now});
      return {
        allowed: true,
        remaining: tokens - 1,
        retryAfterMs: 0
      }
    }

    buckets.set(key, {tokens: tokens, lastRefillAt: now});
    return {
      allowed: false,
      remaining: tokens,
      retryAfterMs: Math.ceil(((1-tokens)/refillRate)*1000),
    }
  }

  function cleanup(){
    const now = clock();
    for(const [key, bucket] of buckets){
      if((((now - bucket.lastRefillAt)/1000*refillRate)+bucket.tokens) >= capacity){
        buckets.delete(key);
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
