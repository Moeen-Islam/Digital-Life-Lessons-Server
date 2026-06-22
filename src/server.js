import app from "./app.js";
import { env } from "./config.js";

app.listen(env.port, () => {
  console.log(`Server running on ${env.serverUrl}`);
});