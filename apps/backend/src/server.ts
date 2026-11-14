import { app } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen(port, host, () => {
  process.stdout.write(`Samren API listening on http://${host}:${port}\n`);
});