import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class GoogleService {
  async getTokens(code: string, codeVerifier: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth env vars are missing');
    }

    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');
    params.append('code_verifier', codeVerifier); // ← CLAVE

    console.log(params.toString());
    const res = await axios.post(
      'https://oauth2.googleapis.com/token',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    return res.data;
  }

  async getUserInfo(idToken: string) {
    // el idToken es un JWT firmado por Google con datos del user
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const { data }: any = await axios.get(url);

    if (!data?.email_verified)
      throw new UnauthorizedException('Email not verified');

    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
      googleId: data.sub,
    };
  }
}
