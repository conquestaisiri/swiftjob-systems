import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Optional: serve the built frontend so a single process hosts both API and site
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(process.cwd(), "../swiftjob-systems/dist/public");
const hasFrontend = fs.existsSync(frontendDist);

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable for API, enable for frontend
  }),
);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 applications per hour
  message: { error: "Too many applications submitted, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 contact messages per hour
  message: { error: "Too many messages submitted, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const magicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 magic-link requests per 15 minutes
  message: { error: "Too many sign-in attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          ip: req.ip,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
app.use("/api", apiLimiter);
app.use("/api/applications", applicationLimiter);
app.use("/api/contact", contactLimiter);
app.use("/api/auth/magic-link", magicLinkLimiter);

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
});

app.use("/api", router);

// Health check (no rate limit)
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve the built frontend (SPA) in production if available
if (hasFrontend) {
  app.use(express.static(frontendDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== "GET" ||
      req.path.startsWith("/api") ||
      req.path === "/healthz"
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
