export function createLeakyBucket({
  capacity,
  leakRate,
}) {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new TypeError("capacity must be a positive safe integer");
  }

  if (!Number.isFinite(leakRate) || leakRate <= 0) {
    throw new TypeError("leakRate must be a positive finite number");
  }

  const intervalMs = 1000 / leakRate;
  const clients = new Map();

  async function schedule(key, task) {
    if(typeof key !== "string" || key.length === 0){
      throw new TypeError("key must be a non-empty string");
    }
    if(typeof task !== "function"){
      throw new TypeError("task must be a function");
    }

    let client = clients.get(key);

    if (!client){
      client = {
        queue: [],
        running: false,
        nextStartAt: null,
        timer: null
      };
      clients.set(key, client);
    }

    if (client.queue.length >= capacity){
      throw new Error("Queue is full");
    }

    return new Promise((resolve, reject) => {
      client.queue.push({task, resolve, reject});
      processQueue(key, client);
    })
  }

  async function processQueue(key, client) {
    if(client.running || client.timer !== null){
      return
    }

    const now = Date.now();
    const delayMs = client.nextStartAt === null ? 0 : Math.max(0, client.nextStartAt - now);

    if(client.queue.length === 0 && delayMs === 0){
      clients.delete(key);
      return;
    }

    if(delayMs > 0){
      client.timer = setTimeout(() => {
        client.timer = null;
        processQueue(client);
      }, delayMs);
      return;
    }

    let job = client.queue.shift();
    client.running = true;
    client.nextStartAt = now + intervalMs;

    try{
      const result = await job.task();
      job.resolve(result);
    }catch(error){
      job.reject(error);
    }finally{
      client.running = false;
      processQueue(client);
    }
  }

  return { schedule };
}
