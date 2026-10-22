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
    // TODO: Validate key and task before creating client state.
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
      processQueue(client);
    })
  }

  async function processQueue(client) {
    if(client.running || client.timer !== null || client.queue.length === 0){
      return
    }

    const now = Date.now();
    const delayMs = client.nextStartAt === null ? 0 : Math.max(0, client.nextStartAt - now);

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
