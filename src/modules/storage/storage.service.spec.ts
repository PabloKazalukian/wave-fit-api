const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  const OLD_ENV = { ...process.env };

  beforeAll(() => {
    process.env.AWS_BUCKET_NAME = 'wavefit-test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    service = new StorageService();
  });

  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('envía el PutObjectCommand y retorna la URL pública del objeto', async () => {
      const buffer = Buffer.from('imagen');

      const url = await service.uploadFile('avatars/u1/avatar.jpg', buffer, 'image/jpeg');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.constructor.name).toBe('PutObjectCommand');
      expect(command.input).toMatchObject({
        Bucket: 'wavefit-test-bucket',
        Key: 'avatars/u1/avatar.jpg',
        Body: buffer,
        ContentType: 'image/jpeg',
      });
      expect(url).toBe(
        'https://wavefit-test-bucket.s3.us-east-1.amazonaws.com/avatars/u1/avatar.jpg',
      );
    });

    it('propaga errores del cliente S3', async () => {
      mockSend.mockRejectedValue(new Error('Access Denied'));

      await expect(
        service.uploadFile('k.txt', Buffer.from('x'), 'text/plain'),
      ).rejects.toThrow('Access Denied');
    });
  });

  describe('deleteFile', () => {
    it('envía el DeleteObjectCommand con bucket y key', async () => {
      await service.deleteFile('avatars/u1/old.png');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.constructor.name).toBe('DeleteObjectCommand');
      expect(command.input).toEqual({
        Bucket: 'wavefit-test-bucket',
        Key: 'avatars/u1/old.png',
      });
    });
  });
});
