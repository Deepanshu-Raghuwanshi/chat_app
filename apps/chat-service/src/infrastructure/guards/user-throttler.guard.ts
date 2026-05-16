import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { RequestWithUser } from "../../interfaces/request-with-user.interface";

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestWithUser): Promise<string> {
    return req.user?.id ?? req.ip ?? "anonymous";
  }
}
