import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LocalEmbeddingService } from "./application/local-embedding.service";
import { LocalLlmService } from "./application/local-llm.service";
import { KnowledgeService } from "./application/knowledge.service";
import { KnowledgeController } from "./interfaces/knowledge.controller";

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, LocalEmbeddingService, LocalLlmService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
