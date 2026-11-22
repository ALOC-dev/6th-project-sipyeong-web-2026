const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BadRequestException, Logger, UnauthorizedException } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ApiExceptionFilter } = require('../dist/api-exception.filter');
const { AppModule } = require('../dist/app.module');
const { CsrfGuard } = require('../dist/auth/csrf.guard');

test('AppModule provides consistent error responses without exposing server errors', async (t) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  t.after(() => app.close());
  const filter = app.get(ApiExceptionFilter);
  const adapter = app.getHttpAdapter();
  const response = {};
  const host = { switchToHttp: () => ({ getResponse: () => response }) };
  const reply = t.mock.method(adapter, 'reply', () => {});
  const log = t.mock.method(Logger.prototype, 'error', () => {});

  function check(exception, expectedStatus, expectedCode) {
    filter.catch(exception, host);
    const [actualResponse, body, status] = reply.mock.calls.at(-1).arguments;
    assert.equal(actualResponse, response);
    assert.equal(status, expectedStatus);
    assert.equal(body.error.code, expectedCode);
    assert.match(body.meta.requestId, /^[0-9a-f-]{36}$/);
    return body;
  }

  check(new UnauthorizedException(), 401, 'UNAUTHENTICATED');
  const csrfHost = { switchToHttp: () => ({ getRequest: () => ({ get: () => undefined }) }) };
  assert.throws(() => app.get(CsrfGuard).canActivate(csrfHost), (error) => {
    check(error, 403, 'CSRF_INVALID');
    return true;
  });
  const validation = check(new BadRequestException(['Invalid field']), 400, 'BAD_REQUEST');
  assert.deepEqual(validation.error.details, ['Invalid field']);
  check({ statusCode: 413, message: 'Too large' }, 413, 'PAYLOAD_TOO_LARGE');

  const internal = new Error('database details');
  const failure = check(internal, 500, 'INTERNAL_SERVER_ERROR');
  assert.ok(!JSON.stringify(failure).includes(internal.message));
  assert.ok(log.mock.calls[0].arguments[0].includes(failure.meta.requestId));
});
