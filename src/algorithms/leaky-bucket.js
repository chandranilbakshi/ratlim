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



  return { schedule };
}
