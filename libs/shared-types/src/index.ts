export * as AuthTypes from './v1/auth.types';
export * as UserTypes from './v1/user.types';
export * as ChatTypes from './v1/chat.types';
export * as MessageTypes from './v1/message.types';

import { components as authComponents } from './v1/auth.types';
import { components as userComponents } from './v1/user.types';

// Export specific schemas for easier use
export type LoginDto = authComponents['schemas']['LoginDto'];
export type RegisterDto = authComponents['schemas']['RegisterDto'];
export type AuthResponse = authComponents['schemas']['AuthResponse'];

export type UserProfile = userComponents['schemas']['UserProfile'];
