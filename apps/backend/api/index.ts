import express from "express";
import dotenv from "dotenv";
import routes from "./routes/Routes.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import qs from "qs";
import { DEV_BYPASS_USER, isSsoBypassEnabled } from "./utils/auth/devBypass.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorMiddleware.js";
import { externalApi } from "./utils/http/externalApi.js";
dotenv.config();

// TLS certificates are always verified (GB-09). Creating the external API
// client now makes a bad EXTERNAL_API_CA_FILE stop startup with a clear error.
externalApi();

if (isSsoBypassEnabled()) {
  console.warn(`BYPASS_SSO is on: POST /api/auth/login-dev signs anyone in as ${DEV_BYPASS_USER.email}.`)
}

const app = express();
const corsOptions = {
  origin: process.env.WEB_URL,
  method: ["GET", "POST", "PUT", "PATCH"],
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());

const port = process.env.PORT || 5000;
app.set('query parser', function (str: string) {
  return qs.parse(str)
})

app.use("/api", routes)
app.use("/api", notFoundHandler);
app.use(errorHandler);

const onListening = () => {
  console.log(`Application is running on port ${port}.`);
};
if (process.env.HOST) app.listen(Number(port), process.env.HOST, onListening);
else app.listen(Number(port), onListening);
