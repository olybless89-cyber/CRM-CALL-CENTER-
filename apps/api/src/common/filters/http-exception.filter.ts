import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  error: {
    code: number;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    path: string;
  };
}

/**
 * Normalizes every thrown error (HttpException or otherwise) into the
 * same envelope shape as ResponseInterceptor's success responses.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string = 'Internal server error';
    let details: unknown;

    if (isHttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const bodyObj = body as { message?: string | string[]; error?: string };
        message = Array.isArray(bodyObj.message)
          ? (bodyObj.error ?? 'Validation failed')
          : (bodyObj.message ?? exception.message);
        details = Array.isArray(bodyObj.message) ? bodyObj.message : undefined;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: ErrorBody = {
      success: false,
      error: { code: status, message, details },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(body);
  }
}
