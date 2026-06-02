import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";

type DmTokenPayload = {
  campaignId: string;
  role: "DM";
};

@Injectable()
export class DmAuthGuard implements CanActivate {
  private readonly jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? "development-secret",
  });

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      params: Record<string, string | undefined>;
    }>();
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Dungeon Master access requires a token.",
      );
    }

    let payload: DmTokenPayload;

    try {
      payload = this.jwt.verify<DmTokenPayload>(header.slice("Bearer ".length));
    } catch {
      throw new UnauthorizedException(
        "Dungeon Master token is invalid or expired.",
      );
    }

    if (payload.role !== "DM") {
      throw new UnauthorizedException("Dungeon Master token is invalid.");
    }

    const slug = request.params.slug;
    if (slug) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!campaign || campaign.id !== payload.campaignId) {
        throw new UnauthorizedException(
          "Dungeon Master token does not match this campaign.",
        );
      }
    }

    return true;
  }
}
