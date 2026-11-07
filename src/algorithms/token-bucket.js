export function createTokenBucket(options) {
  const { capacity, refillRate, backend = "memory" } = options;

  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new TypeError("capacity must be a positive safe integer");
  }
  if (!Number.isFinite(refillRate) || refillRate <= 0) {
    throw new TypeError("refillRate must be a positive finite number");
  }

  if (backend === "memory") {
    return createMemoryTokenBucket(options);
  }
  if (backend === "redis") {
    return createRedisTokenBucket(options);
  }

  throw new TypeError("Unsupported backend");
}

function createMemoryTokenBucket({
  capacity,
  refillRate,
  clock = () => Date.now(),
  cleanupInterval = 30000,
}) {
  const buckets = new Map();

  if (!Number.isSafeInteger(cleanupInterval) || cleanupInterval < 0) {
    throw new TypeError("cleanupInterval must be a positive safe integer");
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

function createRedisTokenBucket({
  capacity,
  refillRate,
  client,
  clock = () => Date.now(),
  cleanupInterval = 30000
}) {
  if (client == null) {
    throw new TypeError("client is required for the Redis backend");
  }

  async function consume(key) {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("key must be a non-empty string");
    }

    const now = clock();
    const redisKey = `ratlim:token-bucket:${key}`;

    let bucket = await client.exists(redisKey);
    let userTokens;
    let userLastRefill;

    if(!bucket){
      userTokens = capacity;
      userLastRefill = now;
    } else{
      userTokens = Number(await client.hget(redisKey, "tokens"));
      userLastRefill = Number(await client.hget(redisKey, "lastRefillAt"));
    }

    const elapsed = now - userLastRefill;
    const tokens = Math.min(capacity, userTokens+(elapsed/1000)*refillRate);

    if(tokens>=1){
      await client.send("HSET", [
        redisKey,
        "tokens", String(tokens-1),
        "lastRefillAt", String(now),
      ]);
      return {
        allowed: true,
        remaining: tokens-1,
        retryAfterMs: 0
      }
    }



    // TODO: Choose a namespaced Redis key for this client's bucket.
    // TODO: Learn how to read tokens and lastRefillAt from a Redis hash.
    // TODO: Implement refill/check/subtract/save atomically with Lua,
    // using capacity and refillRate. Separate reads/writes are practice only.
    // TODO: Set safe expiration and return the decision result.
    throw new Error("Redis backend not implemented yet");
  }

  function close() {
    // No local resources yet. The supplied Redis client belongs to the caller;
    // the caller closes it when finished, as it may serve other limiters too.
  }

  return { consume, close };
}
