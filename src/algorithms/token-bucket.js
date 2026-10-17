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

    if(!buckets.has(key)){
      buckets.set(key, {tokens: capacity, lastRefillAt: now})
    }
    const userTokens = buckets.get(key).tokens;
    const userLastRefill = buckets.get(key).lastRefillAt;

    const elapsed = now - userLastRefill;
    const tokens = Math.min(capacity, userTokens+(elapsed/1000)*refillRate);
    buckets.set(key, {tokens: tokens, lastRefillAt: now});

    if(tokens>=1){
      buckets.get(key).tokens = tokens-1;
      return {
        allowed: true,
        remaining: tokens - 1,
        retryAfterMs: 0
      }
    }else{
      return {
        allowed: false,
        remaining: tokens,
        retryAfterMs: Math.ceil(((1-tokens)/refillRate)*1000),
      }
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
