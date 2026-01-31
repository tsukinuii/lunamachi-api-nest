import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiResponse } from './api-response';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = isHttp ? exception.getResponse() : null;

    // default
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let fields: Record<string, string> | undefined;

    if (isHttp) {
      if (typeof responseBody === 'string') {
        code = `HTTP_${status}`;
        message = responseBody;
      } else if (responseBody && typeof responseBody === 'object') {
        const rb: any = responseBody;

        // best-effort code mapping
        code = rb.code ?? `HTTP_${status}`;

        if (Array.isArray(rb.message)) {
          // from ValidationPipe: array of strings like "email must be an email"
          message = 'Validation failed';
          fields = this.parseValidationMessages(rb.message);
        } else {
          message = rb.message ?? exception.message ?? 'Request error';
        }
      }
    }

    // Optional: hide details on 500
    if (status >= 500) {
      code = 'INTERNAL_ERROR';
      message = 'Internal server error';
      fields = undefined;
    }

    const payload: ApiResponse<null> = {
      success: false,
      error: { code, message, ...(fields ? { fields } : {}) },
      meta: {
        path: req?.url,
      },
    };

    res.status(status).json(payload);
  }

  private parseValidationMessages(messages: string[]): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const msg of messages) {
      const [field, ...rest] = msg.split(' ');
      if (!field) continue;
      fields[field] = rest.join(' ').trim() || msg;
    }
    return fields;
  }
}
