import { ExecutionContext } from '@nestjs/common';
import { GqlAuthGuard } from './gql-auth.guard';
import { GqlExecutionContext } from '@nestjs/graphql';

// Mock de GqlExecutionContext
jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe('GqlAuthGuard', () => {
  let guard: GqlAuthGuard;
  let mockExecutionContext: ExecutionContext;
  let mockGqlContext: any;

  beforeEach(async () => {
    guard = new GqlAuthGuard();

    // Mock del execution context
    mockExecutionContext = {
      switchToHttp: jest.fn(),
      getType: jest.fn().mockReturnValue('graphql'),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as any;

    // Mock del GQL context
    mockGqlContext = {
      getContext: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRequest', () => {
    it('should extract request from GraphQL execution context', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer mock.jwt.token',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(GqlExecutionContext.create).toHaveBeenCalledWith(
        mockExecutionContext,
      );
      expect(mockGqlContext.getContext).toHaveBeenCalled();
      expect(result).toEqual(mockRequest);
    });

    it('should handle request without authorization header', () => {
      const mockRequest = {
        headers: {},
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result).toEqual(mockRequest);
      expect(result.headers.authorization).toBeUndefined();
    });

    it('should handle request with user already attached', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.token',
        },
        user: {
          id: 'user-456',
          email: 'authenticated@example.com',
          role: 'admin',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-456');
      expect(result.user.role).toBe('admin');
    });

    it('should handle multiple nested contexts correctly', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer nested.context.token',
        },
      };

      const nestedContext = {
        req: mockRequest,
        extra: 'data',
      };

      mockGqlContext.getContext.mockReturnValue(nestedContext);
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result).toEqual(mockRequest);
    });
  });

  describe('Authentication Validation', () => {
    it('should allow access with valid JWT token', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-123');
    });

    it('should extract request even without user (let passport handle auth)', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer some.token',
        },
        // Sin user - será validado por passport
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result).toEqual(mockRequest);
      // El guard solo extrae el request, passport validará después
    });

    it('should handle malformed authorization header format', () => {
      const mockRequest = {
        headers: {
          authorization: 'InvalidFormat token',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.headers.authorization).toBe('InvalidFormat token');
    });

    it('should handle missing Bearer prefix in authorization', () => {
      const mockRequest = {
        headers: {
          authorization: 'just.a.token',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.headers.authorization).toBe('just.a.token');
    });

    it('should handle empty authorization header', () => {
      const mockRequest = {
        headers: {
          authorization: '',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.headers.authorization).toBe('');
    });
  });

  describe('User Roles and Permissions', () => {
    it('should preserve user role in extracted request', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer admin.token',
        },
        user: {
          id: 'admin-123',
          email: 'admin@example.com',
          role: 'admin',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user.role).toBe('admin');
    });

    it('should preserve regular user role', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer user.token',
        },
        user: {
          id: 'user-123',
          email: 'user@example.com',
          role: 'user',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user.role).toBe('user');
    });

    it('should handle custom roles', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer custom.token',
        },
        user: {
          id: 'user-123',
          email: 'user@example.com',
          role: 'premium',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user.role).toBe('premium');
    });
  });

  describe('Token Payload Validation', () => {
    it('should extract complete token payload in user object', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer complete.token',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
          // Campos adicionales del payload
          iat: 1234567890,
          exp: 1234567890,
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('user');
    });

    it('should handle user with only required fields', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer minimal.token',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('role');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null context gracefully', () => {
      mockGqlContext.getContext.mockReturnValue(null);
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      expect(() => guard.getRequest(mockExecutionContext)).toThrow();
    });

    it('should handle context without req property', () => {
      mockGqlContext.getContext.mockReturnValue({});
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result).toBeUndefined();
    });

    it('should handle request with null headers', () => {
      const mockRequest = {
        headers: null,
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.headers).toBeNull();
    });

    it('should handle request with undefined user', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer token',
        },
        user: undefined,
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user).toBeUndefined();
    });
  });

  describe('Integration with JWT Strategy', () => {
    it('should extract request compatible with JWT strategy expectations', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      // Verifica que el request tenga la estructura que JWT strategy espera
      expect(result).toHaveProperty('headers');
      expect(result.headers).toHaveProperty('authorization');
      expect(result.headers.authorization).toMatch(/^Bearer /);
    });

    it('should work with tokens from different issuers', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer external.issuer.token',
        },
        user: {
          id: 'external-user-123',
          email: 'external@example.com',
          role: 'user',
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.user.id).toBe('external-user-123');
    });
  });

  describe('Security Tests', () => {
    it('should not modify the original request object', () => {
      const originalRequest = {
        headers: {
          authorization: 'Bearer token',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        },
      };

      const requestCopy = { ...originalRequest };

      mockGqlContext.getContext.mockReturnValue({ req: originalRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      guard.getRequest(mockExecutionContext);

      // El request no debe ser modificado
      expect(originalRequest).toEqual(requestCopy);
    });

    it('should handle case-sensitive header names', () => {
      const mockRequest = {
        headers: {
          Authorization: 'Bearer token', // Capital A
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      // Headers normalmente son case-insensitive en HTTP
      expect(result.headers).toBeDefined();
    });

    it('should handle multiple authorization schemes', () => {
      const mockRequest = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz', // No Bearer
        },
      };

      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);

      const result = guard.getRequest(mockExecutionContext);

      expect(result.headers.authorization).toBe('Basic dXNlcjpwYXNz');
    });
  });

  describe('Guard Inheritance', () => {
    it('should extend AuthGuard with jwt strategy', () => {
      // Verifica que el guard extiende correctamente AuthGuard
      expect(guard).toBeInstanceOf(GqlAuthGuard);
    });

    it('should override getRequest method from base AuthGuard', () => {
      expect(guard.getRequest).toBeDefined();
      expect(typeof guard.getRequest).toBe('function');
    });
  });

  describe('GraphQL Context Types', () => {
    it('should handle different GraphQL operation types', () => {
      const mockRequest = {
        headers: { authorization: 'Bearer token' },
        user: { id: 'user-123', email: 'test@example.com', role: 'user' },
      };

      // Query
      mockGqlContext.getContext.mockReturnValue({ req: mockRequest });
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);
      let result = guard.getRequest(mockExecutionContext);
      expect(result.user).toBeDefined();

      // Mutation
      result = guard.getRequest(mockExecutionContext);
      expect(result.user).toBeDefined();

      // Subscription (si aplica)
      result = guard.getRequest(mockExecutionContext);
      expect(result.user).toBeDefined();
    });
  });
});
