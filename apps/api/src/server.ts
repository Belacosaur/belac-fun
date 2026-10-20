import { buildApp, listenPort } from "./app.js";

const app = buildApp();
const port = listenPort();

await app.listen({ port, host: "0.0.0.0" });
