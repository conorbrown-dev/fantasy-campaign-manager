import { Module } from "@nestjs/common";
import { CampaignsController } from "./interfaces/campaigns.controller";
import { CampaignsService } from "./application/campaigns.service";
import { MonsterManualCatalogService } from "./application/monster-manual-catalog.service";
import { DmAuthGuard } from "./interfaces/dm-auth.guard";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [RealtimeModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, MonsterManualCatalogService, DmAuthGuard],
  exports: [CampaignsService],
})
export class CampaignsModule {}
