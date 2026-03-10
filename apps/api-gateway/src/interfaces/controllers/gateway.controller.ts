import { Controller, All, Req, Res, HttpStatus, Param } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Controller()
export class GatewayController {
  private readonly serviceMap: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.serviceMap = {
      auth: this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001',
      users: this.configService.get<string>('USER_SERVICE_URL') || 'http://localhost:3002',
      chat: this.configService.get<string>('CHAT_SERVICE_URL') || 'http://localhost:3003',
      messages: this.configService.get<string>('MESSAGE_SERVICE_URL') || 'http://localhost:3004',
      notifications: this.configService.get<string>('NOTIFICATION_SERVICE_URL') || 'http://localhost:3005',
    };
  }

  @All(':service/*route')
  async proxy(
    @Param('service') service: string,
    @Param('route') routeParam: string | string[],
    @Req() req: Request,
    @Res() res: Response
  ) {
    const targetUrlBase = this.serviceMap[service];
    
    if (!targetUrlBase) {
      return res.status(HttpStatus.NOT_FOUND).json({
        statusCode: 404,
        message: `Service '${service}' not found or not configured in Gateway`,
      });
    }

    const path = Array.isArray(routeParam) ? routeParam.join('/') : routeParam || '';
    const targetUrl = path ? `${targetUrlBase}/api/v1/${service}/${path}` : `${targetUrlBase}/api/v1/${service}`;

    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: {
          ...req.headers,
          host: new URL(targetUrlBase).host,
        },
        params: req.query,
        validateStatus: (status) => status >= 200 && status < 400,
        maxRedirects: 0,
        withCredentials: true,
      });

      // Forward headers
      Object.entries(response.headers).forEach(([key, value]) => {
        if (key !== 'transfer-encoding') {
          res.setHeader(key, value);
        }
      });

      return res.status(response.status).send(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Gateway Proxy Error (${service}):`, errorMessage);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: 500,
        message: `Error communicating with ${service} service`,
        error: errorMessage,
      });
    }
  }
}
