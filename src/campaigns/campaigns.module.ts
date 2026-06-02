import { Module } from "@nestjs/common";
import { CampaignsController } from "./interfaces/campaigns.controller";
import { CampaignsService } from "./application/campaigns.service";
import { DmAuthGuard } from "./interfaces/dm-auth.guard";

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService, DmAuthGuard],
  exports: [CampaignsService],
})
export class CampaignsModule {}
