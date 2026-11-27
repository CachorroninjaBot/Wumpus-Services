import { definePlugin } from "nitro";
import { maybeCompress } from "./compression";

export default definePlugin((nitro) => {
  const handler = nitro.fetch;
  nitro.fetch = async (request) => {
    const response = await handler(request);
    try {
      return await maybeCompress(request, response);
    } catch {
      return response;
    }
  };
});
