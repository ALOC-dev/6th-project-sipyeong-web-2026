import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter extends BaseExceptionFilter<unknown> {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.adapterHost;
    const response = host.switchToHttp().getResponse();
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }

    const { status, body } = this.readException(exception);
    const payload = typeof body === 'string' ? { message: body } : body;
    const requestId = randomUUID();
    const code = status === HttpStatus.UNAUTHORIZED ? 'UNAUTHENTICATED' : HttpStatus[status] ?? 'HTTP_ERROR';
    const serverError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const details = Array.isArray(payload.message) ? payload.message : [];

    if (serverError) {
      this.logger.error(`Request ${requestId} failed with HTTP ${status}`, exception);
    }

    httpAdapter.reply(response, {
      error: {
        code: serverError ? code : payload.code ?? code,
        message: serverError ? '서버에서 요청을 처리하지 못했습니다.'
          : typeof payload.message === 'string' ? payload.message : '요청을 처리하지 못했습니다.',
        details: serverError ? [] : details,
      },
      meta: { requestId },
    }, status);
  }

  private readException(exception: unknown): {
    status: number;
    body: string | { code?: string; message?: string | string[] };
  } {
    if (exception instanceof HttpException) {
      return { status: exception.getStatus(), body: exception.getResponse() };
    }
    if (this.isHttpError(exception)) {
      return { status: exception.statusCode, body: this.getHttpErrorMessage(exception) };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: {} };
  }
}
