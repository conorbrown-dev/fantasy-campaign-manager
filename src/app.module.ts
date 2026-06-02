import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CampaignsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
