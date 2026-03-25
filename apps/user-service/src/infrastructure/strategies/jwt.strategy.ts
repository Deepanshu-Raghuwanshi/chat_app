import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { PrismaService } from "../persistence/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || "access-secret",
    });
  }

  async validate(payload: JwtPayload) {
    let user = await this.prisma.userProfile.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      // Lazy create profile if missing (resilience against missing Kafka events)
      user = await this.prisma.userProfile.create({
        data: {
          id: payload.sub,
          username:
            payload.email.split("@")[0] +
            "_" +
            Math.random().toString(36).substring(2, 5),
          fullName: payload.email.split("@")[0],
        },
      });
    }

    return user;
  }
}
