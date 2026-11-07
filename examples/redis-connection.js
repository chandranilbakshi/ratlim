import { RedisClient } from "bun";

const client = new RedisClient("redis://127.0.0.1:6379");

try {
  await client.connect();

  await client.set("ratlim:demo:greeting", "hello");

  const value = await client.get("ratlim:demo:greeting");
  console.log(value);

  await client.del("ratlim:demo:greeting");
} finally {
  client.close();
}
