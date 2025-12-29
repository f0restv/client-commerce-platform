import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendSMS,
  sendEmail,
  notifyItemListed,
  notifyItemSold,
  notifySubmissionDeclined,
} from '../index';

// Mock twilio
const mockCreate = vi.fn().mockResolvedValue({ sid: 'SM123' });
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

describe('Notification Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendSMS', () => {
    it('should skip when Twilio is not configured', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_PHONE_NUMBER;

      await sendSMS('+15551234567', 'Test message');

      expect(warnSpy).toHaveBeenCalledWith('[SMS] Twilio not configured, skipping');
      expect(mockCreate).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should send SMS when Twilio is configured', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_PHONE_NUMBER = '+15559876543';

      await sendSMS('+15551234567', 'Test message');

      expect(mockCreate).toHaveBeenCalledWith({
        to: '+15551234567',
        from: '+15559876543',
        body: 'Test message',
      });
    });
  });

  describe('sendEmail', () => {
    it('should skip when no email provider is configured', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      delete process.env.SENDGRID_API_KEY;
      delete process.env.RESEND_API_KEY;

      await sendEmail('test@example.com', 'Test Subject', '<p>Test</p>');

      expect(warnSpy).toHaveBeenCalledWith('[Email] No email provider configured, skipping');

      warnSpy.mockRestore();
    });

    it('should log email when provider is configured', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      process.env.SENDGRID_API_KEY = 'test_key';

      await sendEmail('test@example.com', 'Test Subject', '<p>Test</p>');

      expect(logSpy).toHaveBeenCalledWith('[Email] To: test@example.com, Subject: Test Subject');

      logSpy.mockRestore();
    });
  });

  describe('notifyItemListed', () => {
    const mockData = {
      client: {
        name: 'John Doe',
        phone: '+15551234567',
        email: 'john@example.com',
      },
      item: {
        description: '1921 Morgan Silver Dollar MS-65',
        shortCode: 'ABC123',
        clientNet: 150,
        listPrice: 199,
      },
      appUrl: 'https://app.example.com',
    };

    beforeEach(() => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_PHONE_NUMBER = '+15559876543';
      process.env.SENDGRID_API_KEY = 'test_key';
    });

    it('should send SMS with correct message format', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemListed(mockData);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+15551234567',
          body: expect.stringContaining('Your item is now live!'),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('1921 Morgan Silver Dollar MS-65'),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Your Net: $150'),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('REMOVE ABC123'),
        })
      );
    });

    it('should send email with correct subject', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemListed(mockData);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Listed: 1921 Morgan Silver Dollar MS-65')
      );

      logSpy.mockRestore();
    });

    it('should only send SMS when client has no email', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemListed({
        ...mockData,
        client: { name: 'John Doe', phone: '+15551234567' },
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should only send email when client has no phone', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemListed({
        ...mockData,
        client: { name: 'John Doe', email: 'john@example.com' },
      });

      expect(mockCreate).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should send nothing when client has no contact info', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemListed({
        ...mockData,
        client: { name: 'John Doe' },
      });

      expect(mockCreate).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe('notifyItemSold', () => {
    const mockData = {
      client: {
        name: 'John Doe',
        phone: '+15551234567',
        email: 'john@example.com',
      },
      item: {
        description: '1921 Morgan Silver Dollar MS-65',
        clientNet: 150,
      },
      buyer: {
        name: 'Jane Smith',
        address: '123 Main St, Anytown, USA 12345',
      },
    };

    beforeEach(() => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_PHONE_NUMBER = '+15559876543';
      process.env.SENDGRID_API_KEY = 'test_key';
    });

    it('should send SMS with sold notification and shipping info', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemSold(mockData);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('SOLD:'),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Ship to:'),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Jane Smith'),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('$150 within 24hrs'),
        })
      );
    });

    it('should send email with sold notification', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemSold(mockData);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('SOLD: 1921 Morgan Silver Dollar MS-65')
      );

      logSpy.mockRestore();
    });

    it('should handle client with only phone', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemSold({
        ...mockData,
        client: { name: 'John Doe', phone: '+15551234567' },
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should handle client with only email', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyItemSold({
        ...mockData,
        client: { name: 'John Doe', email: 'john@example.com' },
      });

      expect(mockCreate).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe('notifySubmissionDeclined', () => {
    const mockData = {
      client: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      submission: {
        description: '1921 Morgan Silver Dollar',
        desiredNet: 200,
      },
      reason: 'Market value is lower than requested net.',
    };

    beforeEach(() => {
      process.env.SENDGRID_API_KEY = 'test_key';
    });

    it('should send email with decline reason', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifySubmissionDeclined(mockData);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Submission Update')
      );

      logSpy.mockRestore();
    });

    it('should not send notification when client has no email', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifySubmissionDeclined({
        ...mockData,
        client: { name: 'John Doe' },
      });

      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should include suggested net when provided', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifySubmissionDeclined({
        ...mockData,
        suggestedNet: 150,
      });

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe('parallel notification sending', () => {
    it('should send SMS and email in parallel', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_PHONE_NUMBER = '+15559876543';
      process.env.SENDGRID_API_KEY = 'test_key';

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockData = {
        client: {
          name: 'John Doe',
          phone: '+15551234567',
          email: 'john@example.com',
        },
        item: {
          description: 'Test Item',
          shortCode: 'TEST1',
          clientNet: 100,
          listPrice: 150,
        },
        appUrl: 'https://app.example.com',
      };

      await notifyItemListed(mockData);

      // Both SMS and email should be sent
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledTimes(1);

      logSpy.mockRestore();
    });
  });
});
