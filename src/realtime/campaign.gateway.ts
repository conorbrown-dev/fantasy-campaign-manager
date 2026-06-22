import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

type JoinCampaignPayload = {
  slug: string;
};

type BgmSyncPayload = {
  slug: string;
  assetUrl: string;
  startedAt: string;
};

type CampaignMapSyncPayload = {
  slug: string;
  assetUrl: string;
  startedAt: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CampaignGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage("campaign:join")
  joinCampaign(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinCampaignPayload,
  ) {
    void socket.join(this.room(payload.slug));
    return { joined: payload.slug };
  }

  @SubscribeMessage("bgm:sync")
  syncBgm(@MessageBody() payload: BgmSyncPayload) {
    this.server.to(this.room(payload.slug)).emit("bgm:sync", payload);
  }

  @SubscribeMessage("campaign-map:sync")
  syncCampaignMap(@MessageBody() payload: CampaignMapSyncPayload) {
    this.server.to(this.room(payload.slug)).emit("campaign-map:sync", payload);
  }

  private room(slug: string) {
    return `campaign:${slug}`;
  }
}
