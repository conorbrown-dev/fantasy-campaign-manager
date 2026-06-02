import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { mkdirSync } from "fs";
import { join } from "path";
import * as express from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  console.log(`Starting API server on port ${port}...`);

  const app = await NestFactory.create(AppModule);
  const uploadsPath = join(process.cwd(), "uploads");
  mkdirSync(uploadsPath, { recursive: true });
  app.use("/uploads", express.static(uploadsPath));

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(port);
  console.log(`API server listening at http://localhost:${port}/api`);
}

bootstrap().catch((error) => {
  console.error("API server failed to start.", error);
  process.exit(1);
});
