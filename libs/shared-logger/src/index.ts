import { Params } from 'nestjs-pino';

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
          },
        }
      : undefined,
    quietReqLogger: true,
    autoLogging: true,
  },
};
