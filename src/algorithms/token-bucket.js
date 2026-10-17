export function createTokenBucket({
  capacity,
  refillRate,
  clock = () => Date.now(),
}) {
  const buckets = new Map();

  function consume(key){
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new TypeError("capacity must be a positive safe integer");
    }
    if (!Number.isFinite(refillRate) || refillRate <= 0) {
      throw new TypeError("refillRate must be a positive finite number");
    }
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("key must be a non-empty string");
    }

    const now = clock();

    if(!buckets.has(key)){
      buckets.set(key, {tokens: capacity, lastRefillAt: now})
    }
    const userTokens = buckets.get(key).tokens;
    const userLastRefill = buckets.get(key).lastRefillAt;

    let elapsed = now - userLastRefill;
    let tokens = Math.min(capacity, userTokens+(elapsed/1000)*refillRate);
    buckets.set(key, {tokens: tokens, lastRefillAt: now});

    if(tokens>=1){
      buckets.set(key, {tokens: tokens-1});
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
  return {consume}
}
