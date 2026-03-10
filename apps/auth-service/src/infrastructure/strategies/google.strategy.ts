import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'google-client-id',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'google-client-secret',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3001/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { name, emails, photos, id } = profile;
    const user = {
      googleId: id,
      email: emails ? emails[0].value : '',
      firstName: name?.givenName,
      lastName: name?.familyName,
      picture: photos ? photos[0].value : '',
      accessToken,
    };
    done(null, user);
  }
}
