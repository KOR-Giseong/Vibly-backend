import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AdminLogService } from './admin-log.service';

// HTTP 메서드 → 액션 이름 매핑
function resolveAction(method: string, url: string): string {
  const path = url.replace(/\/api\//, '').replace(/\/[0-9a-f-]{36}/g, '/:id');
  return `${method}:${path}`;
}

@Injectable()
export class AdminLogInterceptor implements NestInterceptor {
  constructor(private adminLogService: AdminLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const adminId: string | undefined = req.user?.id;
    const method: string = req.method;
    const url: string = req.url ?? req.path ?? '';
    const ip: string = req.ip ?? req.headers?.['x-forwarded-for'] ?? '';

    // 관리자 경로만 로깅 (GET 제외 - 조회는 로그 불필요)
    if (!adminId || !url.includes('/admin/') || method === 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.adminLogService.log(adminId, resolveAction(method, url), {
          ip,
          detail: { body: sanitizeBody(req.body) },
        });
      }),
    );
  }
}

function sanitizeBody(body: Record<string, any>): Record<string, any> {
  if (!body || typeof body !== 'object') return {};
  const safe = { ...body };
  // 민감 필드 제거
  delete safe.password;
  delete safe.passwordHash;
  delete safe.base64;
  delete safe.imageBase64;
  return safe;
}
