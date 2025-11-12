export interface Token {
  access_token: any;
  userId: string;
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}
