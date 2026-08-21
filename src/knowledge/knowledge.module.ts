import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LocalEmbeddingService } from "./application/local-embedding.service";
import { KnowledgeService } from "./application/knowledge.service";
import {
  KnowledgeController,
  PlayerReferenceController,
} from "./interfaces/knowledge.controller";

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeController, PlayerReferenceController],
  providers: [KnowledgeService, LocalEmbeddingService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
