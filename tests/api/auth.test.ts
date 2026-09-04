import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAllIndexes, clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { hashPassword, hashToken } from '@/server/lib/password';
import {
  MAX_FAILED_ATTEMPTS,
  login,
  logout,
  refreshSession,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
} from '@/server/services/auth.service';
import { verifyAccessToken, verifyRefreshToken } from '@/server/lib/jwt';
import { getRefreshSessions } from '@/server/repositories/user.repository';

// أسرار اختبار — لا تُستخدم خارج الاختبارات
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
process.env.APP_URL = 'http://localhost:3000';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
}, 60_000);

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  resetRateLimitStore();
});

afterEach(() => {
  vi.useRealTimers();
});

/* ---- أدوات ---- */

const VALID_REGISTRATION = {
  fullName: 'أحمد محمد علي',
  phone: '+201012345678',
  email: 'ahmed@example.com',
  area: 'حي الجامعة',
  city: 'الفيوم' as const,
  password: 'Ahmed1234',
  confirmPassword: 'Ahmed1234',
  acceptTerms: true as const,
};

async function seedUser(overrides: Record<string, unknown> = {}) {
  return User.create({
    role: 'CUSTOMER',
    fullName: 'سارة محمود',
    phone: '+201099999999',
    email: 'sara@example.com',
    passwordHash: await hashPassword('Sara12345'),
    status: 'ACTIVE',
    ...overrides,
  });
}

/* ================================================================== */

describe('التسجيل', () => {
  it('ينشئ حسابًا ويصدر جلسة', async () => {
    const { user, tokens } = await registerCustomer(VALID_REGISTRATION, {});

    expect(user.role).toBe('CUSTOMER');
    expect(user.phone).toBe('+201012345678');
    expect(user.status).toBe('ACTIVE');
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
  });

  it('لا يعيد passwordHash في أي حال', async () => {
    const { user } = await registerCustomer(VALID_REGISTRATION, {});
    expect(user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(user)).not.toContain('$argon2');
  });

  it('يخزّن كلمة المرور مجزّأة بـargon2id لا نصًا صريحًا', async () => {
    await registerCustomer(VALID_REGISTRATION, {});
    const stored = await User.findOne({ phone: '+201012345678' }).select('+passwordHash').lean();

    expect(stored?.passwordHash).toBeDefined();
    expect(stored?.passwordHash).not.toBe('Ahmed1234');
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('يرفض هاتفًا مسجّلًا', async () => {
    await registerCustomer(VALID_REGISTRATION, {});
    await expect(
      registerCustomer({ ...VALID_REGISTRATION, email: 'other@example.com' }, {})
    ).rejects.toThrow(/مسجّل بالفعل/);
  });

  it('يرفض بريدًا مسجّلًا', async () => {
    await registerCustomer(VALID_REGISTRATION, {});
    await expect(
      registerCustomer({ ...VALID_REGISTRATION, phone: '+201055555555' }, {})
    ).rejects.toThrow(/مسجّل بالفعل/);
  });

  it('يسجّل جلسة تحديث واحدة', async () => {
    const { user } = await registerCustomer(VALID_REGISTRATION, {});
    const sessions = await getRefreshSessions(user.id);
    expect(sessions).toHaveLength(1);
  });
});

describe('تسجيل الدخول', () => {
  it('ينجح بالهاتف', async () => {
    await seedUser();
    const { user } = await login(
      { identifier: '01099999999', password: 'Sara12345', remember: false },
      {}
    );
    expect(user.fullName).toBe('سارة محمود');
  });

  it('ينجح بالبريد', async () => {
    await seedUser();
    const { user } = await login(
      { identifier: 'sara@example.com', password: 'Sara12345', remember: false },
      {}
    );
    expect(user.email).toBe('sara@example.com');
  });

  it('يقبل صيغ الهاتف المختلفة', async () => {
    await seedUser();
    for (const identifier of ['01099999999', '+201099999999', '010 9999 9999']) {
      await expect(
        login({ identifier, password: 'Sara12345', remember: false }, {})
      ).resolves.toBeDefined();
    }
  });

  it('يعيد رسالة موحّدة لحساب غير موجود ولكلمة مرور خاطئة', async () => {
    await seedUser();

    const missing = await login(
      { identifier: '01088888888', password: 'Whatever123', remember: false },
      {}
    ).catch((error: Error) => error.message);

    const wrongPassword = await login(
      { identifier: '01099999999', password: 'WrongPass123', remember: false },
      {}
    ).catch((error: Error) => error.message);

    // منع تعداد الحسابات — لا فرق بين الحالتين
    expect(missing).toBe(wrongPassword);
    expect(missing).toContain('غير صحيحة');
  });

  it('يرفض حسابًا موقوفًا', async () => {
    await seedUser({ status: 'SUSPENDED' });
    await expect(
      login({ identifier: '01099999999', password: 'Sara12345', remember: false }, {})
    ).rejects.toThrow(/إيقاف حسابك/);
  });

  it('يصفّر عدّاد المحاولات بعد نجاح الدخول', async () => {
    const user = await seedUser({ failedLoginAttempts: 3 });
    await login({ identifier: '01099999999', password: 'Sara12345', remember: false }, {});

    const updated = await User.findById(user._id).lean();
    expect(updated?.failedLoginAttempts).toBe(0);
    expect(updated?.lastLoginAt).toBeInstanceOf(Date);
  });
});

describe('قفل الحساب بعد المحاولات الفاشلة', () => {
  it('يقفل الحساب بعد 5 محاولات', async () => {
    await seedUser();

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i += 1) {
      await expect(
        login({ identifier: '01099999999', password: 'Wrong123456', remember: false }, {})
      ).rejects.toThrow(/غير صحيحة/);
    }

    // المحاولة الخامسة تقفل
    await expect(
      login({ identifier: '01099999999', password: 'Wrong123456', remember: false }, {})
    ).rejects.toThrow(/قفل الحساب/);
  });

  it('يرفض كلمة المرور الصحيحة أثناء القفل', async () => {
    await seedUser({
      failedLoginAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: new Date(Date.now() + 15 * 60_000),
    });

    await expect(
      login({ identifier: '01099999999', password: 'Sara12345', remember: false }, {})
    ).rejects.toThrow(/قفل الحساب/);
  });

  it('يسمح بالدخول بعد انتهاء مدة القفل', async () => {
    await seedUser({
      failedLoginAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: new Date(Date.now() - 1000),
    });

    await expect(
      login({ identifier: '01099999999', password: 'Sara12345', remember: false }, {})
    ).resolves.toBeDefined();
  });
});

describe('تنظيف الجلسات المنتهية', () => {
  it('يحذف الجلسات المنتهية عند الدخول ويبقي الصالحة', async () => {
    const user = await seedUser();

    // جلستان: واحدة منتهية وواحدة صالحة
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          refreshTokens: [
            { hash: 'expired-session', expiresAt: new Date(Date.now() - 86_400_000), createdAt: new Date() },
            { hash: 'valid-session', expiresAt: new Date(Date.now() + 86_400_000), createdAt: new Date() },
          ],
        },
      }
    );

    await login({ identifier: '01099999999', password: 'Sara12345', remember: true }, {});

    const sessions = await getRefreshSessions(String(user._id));
    const hashes = sessions.map((s) => s.hash);

    // المنتهية حُذفت، والصالحة بقيت، وأُضيفت جلسة الدخول الجديدة
    expect(hashes).not.toContain('expired-session');
    expect(hashes).toContain('valid-session');
    expect(sessions).toHaveLength(2);
  });
});

describe('تدوير توكن التحديث', () => {
  it('يصدر توكنًا جديدًا ويُبطل القديم', async () => {
    const { user, tokens } = await registerCustomer(VALID_REGISTRATION, {});

    const refreshed = await refreshSession(tokens.refreshToken, {});
    expect(refreshed.tokens.refreshToken).not.toBe(tokens.refreshToken);

    const sessions = await getRefreshSessions(user.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.hash).toBe(hashToken(refreshed.tokens.refreshToken));
  });

  it('توكن الوصول الجديد صالح ويحمل الدور', async () => {
    const { tokens } = await registerCustomer(VALID_REGISTRATION, {});
    const refreshed = await refreshSession(tokens.refreshToken, {});

    const claims = await verifyAccessToken(refreshed.tokens.accessToken);
    expect(claims?.role).toBe('CUSTOMER');
    expect(claims?.sub).toBe(refreshed.user.id);
  });

  it('🔐 إعادة استخدام توكن مُدوَّر تُبطل كل الجلسات', async () => {
    const { user, tokens } = await registerCustomer(VALID_REGISTRATION, {});

    // استخدام أول — يدوّر التوكن
    const first = await refreshSession(tokens.refreshToken, {});
    expect(await getRefreshSessions(user.id)).toHaveLength(1);

    // إعادة استخدام التوكن القديم = مؤشر سرقة
    await expect(refreshSession(tokens.refreshToken, {})).rejects.toThrow(/انتهت الجلسة/);

    // كل الجلسات أُبطلت — حتى الجديدة
    expect(await getRefreshSessions(user.id)).toHaveLength(0);
    await expect(refreshSession(first.tokens.refreshToken, {})).rejects.toThrow(/انتهت الجلسة/);
  });

  it('يرفض توكنًا بتوقيع خاطئ', async () => {
    await expect(refreshSession('not.a.valid.token', {})).rejects.toThrow(/انتهت الجلسة/);
  });

  it('يرفض توكن الوصول كتوكن تحديث (فصل الجمهور)', async () => {
    const { tokens } = await registerCustomer(VALID_REGISTRATION, {});
    await expect(refreshSession(tokens.accessToken, {})).rejects.toThrow(/انتهت الجلسة/);
  });

  it('يرفض التحديث لحساب أُوقف بعد إصدار التوكن', async () => {
    const { user, tokens } = await registerCustomer(VALID_REGISTRATION, {});
    await User.updateOne({ _id: user.id }, { $set: { status: 'SUSPENDED' } });

    await expect(refreshSession(tokens.refreshToken, {})).rejects.toThrow(/إيقاف حسابك/);
    expect(await getRefreshSessions(user.id)).toHaveLength(0);
  });
});

describe('تسجيل الخروج', () => {
  it('يزيل الجلسة الحالية فقط', async () => {
    const { user, tokens } = await registerCustomer(VALID_REGISTRATION, {});
    // جلسة ثانية من جهاز آخر
    const second = await login(
      { identifier: '01012345678', password: 'Ahmed1234', remember: true },
      { userAgent: 'device-2' }
    );

    expect(await getRefreshSessions(user.id)).toHaveLength(2);

    await logout(tokens.refreshToken, { allDevices: false });
    const remaining = await getRefreshSessions(user.id);

    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.hash).toBe(hashToken(second.tokens.refreshToken));
  });

  it('allDevices ينهي كل الجلسات', async () => {
    const { user, tokens } = await registerCustomer(VALID_REGISTRATION, {});
    await login({ identifier: '01012345678', password: 'Ahmed1234', remember: true }, {});

    await logout(tokens.refreshToken, { allDevices: true });
    expect(await getRefreshSessions(user.id)).toHaveLength(0);
  });

  it('لا يفشل بلا توكن', async () => {
    await expect(logout(null, { allDevices: false })).resolves.toBeUndefined();
    await expect(logout('garbage', { allDevices: false })).resolves.toBeUndefined();
  });
});

describe('إعادة تعيين كلمة المرور', () => {
  it('لا يكشف وجود البريد من عدمه', async () => {
    await seedUser();
    // كلاهما ينجح بصمت
    await expect(requestPasswordReset('sara@example.com')).resolves.toBeUndefined();
    await expect(requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
  });

  it('يخزّن التوكن مجزّأً لا صريحًا', async () => {
    const user = await seedUser();
    await requestPasswordReset('sara@example.com');

    const updated = await User.findById(user._id)
      .select('+passwordResetTokenHash +passwordResetExpiresAt')
      .lean();

    expect(updated?.passwordResetTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(updated?.passwordResetExpiresAt).toBeInstanceOf(Date);
  });

  it('يغيّر كلمة المرور بتوكن صالح', async () => {
    const user = await seedUser();
    const token = 'a'.repeat(43);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: hashToken(token),
          passwordResetExpiresAt: new Date(Date.now() + 30 * 60_000),
        },
      }
    );

    await resetPassword({ token, password: 'NewPass1234' });

    await expect(
      login({ identifier: '01099999999', password: 'NewPass1234', remember: false }, {})
    ).resolves.toBeDefined();
    await expect(
      login({ identifier: '01099999999', password: 'Sara12345', remember: false }, {})
    ).rejects.toThrow();
  });

  it('التوكن يُستخدم مرة واحدة فقط', async () => {
    const user = await seedUser();
    const token = 'b'.repeat(43);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: hashToken(token),
          passwordResetExpiresAt: new Date(Date.now() + 30 * 60_000),
        },
      }
    );

    await resetPassword({ token, password: 'NewPass1234' });
    await expect(resetPassword({ token, password: 'Another1234' })).rejects.toThrow(/غير صالح/);
  });

  it('يرفض التوكن المنتهي', async () => {
    const user = await seedUser();
    const token = 'c'.repeat(43);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: hashToken(token),
          passwordResetExpiresAt: new Date(Date.now() - 1000),
        },
      }
    );

    await expect(resetPassword({ token, password: 'NewPass1234' })).rejects.toThrow(/غير صالح/);
  });

  it('🔐 تغيير كلمة المرور يُبطل كل الجلسات', async () => {
    const { user } = await registerCustomer(VALID_REGISTRATION, {});
    await login({ identifier: '01012345678', password: 'Ahmed1234', remember: true }, {});
    expect(await getRefreshSessions(user.id)).toHaveLength(2);

    const token = 'd'.repeat(43);
    await User.updateOne(
      { _id: user.id },
      {
        $set: {
          passwordResetTokenHash: hashToken(token),
          passwordResetExpiresAt: new Date(Date.now() + 30 * 60_000),
        },
      }
    );

    await resetPassword({ token, password: 'Recovered123' });
    expect(await getRefreshSessions(user.id)).toHaveLength(0);
  });

  it('يفكّ القفل عند إعادة التعيين', async () => {
    const user = await seedUser({
      failedLoginAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: new Date(Date.now() + 15 * 60_000),
    });
    const token = 'e'.repeat(43);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: hashToken(token),
          passwordResetExpiresAt: new Date(Date.now() + 30 * 60_000),
        },
      }
    );

    await resetPassword({ token, password: 'Recovered123' });

    await expect(
      login({ identifier: '01099999999', password: 'Recovered123', remember: false }, {})
    ).resolves.toBeDefined();
  });
});

describe('توكنات JWT', () => {
  it('توكن الوصول يحمل الدور والحالة', async () => {
    const { tokens, user } = await registerCustomer(VALID_REGISTRATION, {});
    const claims = await verifyAccessToken(tokens.accessToken);

    expect(claims?.sub).toBe(user.id);
    expect(claims?.role).toBe('CUSTOMER');
    expect(claims?.status).toBe('ACTIVE');
  });

  it('توكن التحديث لا يُقبل كتوكن وصول', async () => {
    const { tokens } = await registerCustomer(VALID_REGISTRATION, {});
    expect(await verifyAccessToken(tokens.refreshToken)).toBeNull();
  });

  it('توكن الوصول لا يُقبل كتوكن تحديث', async () => {
    const { tokens } = await registerCustomer(VALID_REGISTRATION, {});
    expect(await verifyRefreshToken(tokens.accessToken)).toBeNull();
  });

  it('يرفض توكنًا مُعدَّلًا', async () => {
    const { tokens } = await registerCustomer(VALID_REGISTRATION, {});
    const tampered = `${tokens.accessToken.slice(0, -4)}AAAA`;
    expect(await verifyAccessToken(tampered)).toBeNull();
  });

  it('لا يحتوي توكن الوصول على أي بيانات حسّاسة', async () => {
    const { tokens } = await registerCustomer(VALID_REGISTRATION, {});
    const payload = JSON.parse(
      Buffer.from(tokens.accessToken.split('.')[1]!, 'base64url').toString('utf8')
    ) as Record<string, unknown>;

    expect(payload).not.toHaveProperty('passwordHash');
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('phone');
  });
});
