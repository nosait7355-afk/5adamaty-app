import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildAllIndexes, clearTestDb, startTestDb, stopTestDb } from '../helpers/db';

/* FCM بديل: يسجّل ما أُرسل، ويرفض رمزًا «ميتًا» كما تفعل Firebase */
const sent: Array<{ tokens: string[]; title: string; actionUrl?: string | undefined }> = [];
vi.mock('@/server/lib/fcm', () => ({
  isPushConfigured: () => true,
  sendPush: async (tokens: string[], message: { title: string; actionUrl?: string }) => {
    sent.push({ tokens, title: message.title, actionUrl: message.actionUrl });
    return tokens.filter((token) => token.startsWith('dead'));
  },
}));

import { DeviceToken } from '@/server/db/models';
import {
  pushToUsers,
  registerDevice,
  removeDevicesOfUser,
  unregisterDevice,
} from '@/server/services/push.service';
import { createNotification } from '@/server/repositories/provider.repository';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
}, 60_000);

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
  sent.length = 0;
});

const alice = new Types.ObjectId().toString();
const bob = new Types.ObjectId().toString();
const TOKEN = 'a'.repeat(40);

describe('أجهزة الإشعارات', () => {
  it('يسجّل الجهاز مرة واحدة ويجدّد آخر استخدام', async () => {
    await registerDevice(alice, TOKEN);
    await registerDevice(alice, TOKEN);
    expect(await DeviceToken.countDocuments()).toBe(1);
  });

  it('جهاز انتقل لحساب آخر يتبع الحساب الجديد', async () => {
    await registerDevice(alice, TOKEN);
    await registerDevice(bob, TOKEN);
    const device = await DeviceToken.findOne({ token: TOKEN }).lean();
    expect(String(device?.userId)).toBe(bob);
  });

  it('🔐 لا يلغي أحدٌ جهاز حساب آخر', async () => {
    await registerDevice(alice, TOKEN);
    await unregisterDevice(bob, TOKEN);
    expect(await DeviceToken.countDocuments()).toBe(1);
    await unregisterDevice(alice, TOKEN);
    expect(await DeviceToken.countDocuments()).toBe(0);
  });

  it('حذف الحساب يحذف كل أجهزته', async () => {
    await registerDevice(alice, TOKEN);
    await registerDevice(alice, 'b'.repeat(40));
    await removeDevicesOfUser(alice);
    expect(await DeviceToken.countDocuments()).toBe(0);
  });
});

describe('الإرسال', () => {
  it('يرسل لأجهزة الحساب المعني فقط ويحذف الرموز الميتة', async () => {
    await registerDevice(alice, TOKEN);
    await registerDevice(alice, `dead${'x'.repeat(40)}`);
    await registerDevice(bob, 'c'.repeat(40));

    await pushToUsers([alice], { title: 'مرحبًا', body: 'نص' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.tokens.sort()).toEqual([TOKEN, `dead${'x'.repeat(40)}`].sort());
    expect(await DeviceToken.countDocuments({ userId: new Types.ObjectId(alice) })).toBe(1);
  });

  it('كل إشعار داخلي يصل للجهاز أيضًا مع رابطه', async () => {
    await registerDevice(alice, TOKEN);
    await createNotification({
      userId: alice,
      type: 'SYSTEM',
      title: 'تم اعتماد حسابك',
      body: 'ملفك ظاهر الآن',
      entityType: 'SYSTEM',
      actionUrl: '/provider/profile',
    });
    expect(sent).toEqual([{ tokens: [TOKEN], title: 'تم اعتماد حسابك', actionUrl: '/provider/profile' }]);
  });
});
