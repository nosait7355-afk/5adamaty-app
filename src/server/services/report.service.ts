import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { Report, ServiceProvider, User } from '@/server/db/models';
import { badRequest, notFound } from '@/server/lib/errors';
import { writeAuditLog } from '@/server/repositories/provider.repository';
import type { SessionUser } from '@/server/middleware/with-auth';
import type { ReportReason, ReportStatus } from '@/shared/constants/reports';
import type { CreateReportInput, ResolveReportInput } from '@/shared/schemas/report.schema';

/**
 * بلاغات المستخدمين عن مقدمي الخدمات — سياسة Google Play للمحتوى الذي
 * ينشئه المستخدمون (UGC): وسيلة إبلاغ داخل التطبيق + مراجعة إدارية.
 */

interface AdminActor {
  id: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface AdminReportDto {
  id: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
  provider: { id: string; displayName: string; isActive: boolean } | null;
  reporter: { id: string; fullName: string } | null;
}

/**
 * يسجّل بلاغًا. بلاغ مفتوح سابق من نفس المستخدم على نفس المزوّد يُحدَّث
 * بدل تكراره — فلا يُغرق مستخدم واحد قائمة الإدارة بنسخ متطابقة.
 */
export async function createReport(
  session: SessionUser,
  providerId: string,
  input: CreateReportInput
): Promise<{ reported: true }> {
  await connectToDatabase();

  const provider = await ServiceProvider.findById(providerId).select('userId').lean();
  if (!provider) throw notFound('مقدم الخدمة غير موجود.');
  if (String(provider.userId) === session.id) {
    throw badRequest('لا يمكنك الإبلاغ عن ملفك الشخصي.');
  }

  const details = input.details?.trim() || undefined;

  await Report.findOneAndUpdate(
    {
      reporterId: new Types.ObjectId(session.id),
      providerId: new Types.ObjectId(providerId),
      status: 'OPEN',
    },
    {
      $set: { reason: input.reason, ...(details ? { details } : {}) },
      ...(details ? {} : { $unset: { details: 1 } }),
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return { reported: true };
}

export async function listReportsForAdmin(options: {
  page: number;
  limit: number;
  status?: ReportStatus | undefined;
}): Promise<{ items: AdminReportDto[]; total: number }> {
  await connectToDatabase();

  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;

  const skip = (options.page - 1) * options.limit;
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean(),
    Report.countDocuments(filter),
  ]);

  const [providers, reporters] = await Promise.all([
    // trusted(): المنقّي العام (sanitizeFilter) يجرّد `$in` من المرشّحات
    ServiceProvider.find({
      _id: mongoose.trusted({ $in: reports.map((report) => report.providerId) }),
    })
      .select('displayName isActive')
      .lean(),
    User.find({ _id: mongoose.trusted({ $in: reports.map((report) => report.reporterId) }) })
      .select('fullName')
      .lean(),
  ]);

  const providerById = new Map(providers.map((provider) => [String(provider._id), provider]));
  const reporterById = new Map(reporters.map((user) => [String(user._id), user]));

  const items = reports.map((report): AdminReportDto => {
    const provider = providerById.get(String(report.providerId));
    const reporter = reporterById.get(String(report.reporterId));
    return {
      id: String(report._id),
      reason: report.reason,
      ...(report.details ? { details: report.details } : {}),
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      ...(report.resolvedAt ? { resolvedAt: report.resolvedAt.toISOString() } : {}),
      provider: provider
        ? { id: String(provider._id), displayName: provider.displayName, isActive: provider.isActive }
        : null,
      reporter: reporter ? { id: String(reporter._id), fullName: reporter.fullName } : null,
    };
  });

  return { items, total };
}

/** إغلاق بلاغ مفتوح بقرار الإدارة — مع أثر في سجل التدقيق. */
export async function resolveReport(
  actor: AdminActor,
  reportId: string,
  input: ResolveReportInput
): Promise<{ id: string; status: ReportStatus }> {
  await connectToDatabase();

  const updated = await Report.findOneAndUpdate(
    { _id: new Types.ObjectId(reportId), status: 'OPEN' },
    {
      $set: {
        status: input.status,
        resolvedBy: new Types.ObjectId(actor.id),
        resolvedAt: new Date(),
      },
    },
    { new: true }
  ).lean();
  if (!updated) throw notFound('البلاغ غير موجود أو تم إغلاقه بالفعل.');

  await writeAuditLog({
    actorId: actor.id,
    action: 'REPORT_RESOLVED',
    entityType: 'Report',
    entityId: reportId,
    before: { status: 'OPEN' },
    after: { status: input.status, providerId: String(updated.providerId) },
    ...(actor.ip ? { ip: actor.ip } : {}),
    ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
  });

  return { id: reportId, status: input.status };
}

