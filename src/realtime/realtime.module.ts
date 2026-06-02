import { Module } from "@nestjs/common";
import { CampaignGateway } from "./campaign.gateway";

@Module({
  providers: [CampaignGateway],
})
export class RealtimeModule {}
