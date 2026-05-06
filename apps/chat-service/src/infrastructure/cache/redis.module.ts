import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { RedisPresenceRepository } from "./redis-presence.repository";

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: "PresenceRepository",
      useClass: RedisPresenceRepository,
    },
  ],
  exports: [RedisService, "PresenceRepository"],
})
export class RedisModule {}
