import "dotenv/config";
import express from "express";
import morgan from "morgan";
import pinoHttp from "pino-http";
import { kotaniRouter } from "./routes/kotani.js";

const app = express();

app.use(express.json({ limit: "256kb" }));
app.use(morgan("combined"));
app.use(
  pinoHttp({
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/kotani", kotaniRouter);

const port = Number(process.env.PORT ?? "8080");
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`backend listening on :${port}`);
});
