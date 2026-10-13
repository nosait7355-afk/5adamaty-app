import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { DeviceToken } from '@/server/db/models';
import { isPushConfigured, sendPush, type PushMessage } from '@/server/lib/fcm';
import { logger } from '@/server/lib/logger';

/**
 * أجهزة الإشعارات وإرسالها.
 *
 * الإرسال «أفضل جهد»: يُستدعى بعد حفظ الإشعار الداخلي، ولا يُفشل أبدًا
 * العملية التي سبّبته (اعتماد مقدم خدمة، بثّ إداري…).
 */

/** يربط رمز الجهاز بالحساب الحالي — جهاز انتقل لحساب آخر ينتقل رمزه معه. */
export async function registerDevice(userId: string, token: string): Promise<void> {
  await connectToDatabase();
  await DeviceToken.updateOne(
    { token },
    { $set: { userId: new Types.ObjectId(userId), lastSeenAt: new Date() } },
    { upsert: true }
  );
}

/** تسجيل الخروج: الجهاز لا يستلم بعدها إشعارات هذا الحساب. */
export async function unregisterDevice(userId: string, token: string): Promise<void> {
  await connectToDatabase();
  await DeviceToken.deleteOne({ token, userId: new Types.ObjectId(userId) });
}

export async function removeDevicesOfUser(userId: string | Types.ObjectId): Promise<void> {
  await connectToDatabase();
  await DeviceToken.deleteMany({ userId: new Types.ObjectId(String(userId)) });
}

export async function pushToUsers(
  userIds: Array<string | Types.ObjectId>,
  message: PushMessage
): Promise<void> {
  if (!isPushConfigured() || userIds.length === 0) return;

  try {
    await connectToDatabase();
    const devices = await DeviceToken.find(
      { userId: mongoose.trusted({ $in: userIds.map((id) => new Types.ObjectId(String(id))) }) },
      'token'
    ).lean<{ token: string }[]>();

    const dead = await sendPush(
      devices.map((device) => device.token),
      message
    );
    if (dead.length > 0) await DeviceToken.deleteMany({ token: mongoose.trusted({ $in: dead }) });
  } catch (error) {
    logger.warn('تعذّر إرسال إشعارات Push', { error: String(error) });
  }
}
