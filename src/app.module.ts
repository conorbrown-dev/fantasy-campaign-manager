import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CampaignsModule,
    KnowledgeModule,
    RealtimeModule,
  ],
})
export class AppModule {}
