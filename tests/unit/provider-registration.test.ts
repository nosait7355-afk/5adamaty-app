import { describe, expect, it } from 'vitest';
import {
  assertCanAcceptOrders,
  canAcceptOrders,
  computeProfileCompletion,
  type CompletionInput,
} from '@/server/services/provider.service';
import {
  adminProvidersQuerySchema,
  providerStep1Schema,
  providerStep2Schema,
  registerProviderSchema,
  updateProviderProfileSchema,
  verificationDecisionSchema,
} from '@/shared/schemas/provider.schema';
import { VERIFICATION_STATUSES } from '@/shared/constants/roles';

/**
 * اختبارات وحدة لتسجيل مقدم الخدمة — بلا قاعدة بيانات.
 */

/* ================================================================== */
/* اكتمال الملف                                                        */
/* ================================================================== */

const EMPTY: CompletionInput = {
  galleryCount: 0,
  requiredDocumentsTotal: 3,
  requiredDocumentsUploaded: 0,
};

const FULL: CompletionInput = {
  bio: 'وصف خدمة مفصّل يتجاوز عشرين حرفًا بوضوح.',
  coverageAreas: ['حي الجامعة'],
  yearsOfExperience: 8,
  galleryCount: 3,
  email: 'p@example.com',
  addressLine: 'شارع الحرية',
  requiredDocumentsTotal: 3,
  requiredDocumentsUploaded: 3,
};

describe('computeProfileCompletion', () => {
  it('يعيد صفرًا لملف فارغ تمامًا', () => {
    expect(computeProfileCompletion(EMPTY)).toBe(0);
  });

  it('يعيد 100 لملف مكتمل', () => {
    expect(computeProfileCompletion(FULL)).toBe(100);
  });

  it('يبقى دائمًا بين 0 و100', () => {
    const overfilled = { ...FULL, requiredDocumentsUploaded: 99, galleryCount: 50 };
    expect(computeProfileCompletion(overfilled)).toBe(100);
  });

  it('المستندات الإلزامية أثقل بند منفرد', () => {
    const withoutDocs = { ...FULL, requiredDocumentsUploaded: 0 };
    const withoutGallery = { ...FULL, galleryCount: 0 };

    expect(computeProfileCompletion(withoutDocs)).toBeLessThan(
      computeProfileCompletion(withoutGallery)
    );
  });

  it('لا يحتسب المستندات إلا عند اكتمالها كلها', () => {
    const partial = { ...FULL, requiredDocumentsUploaded: 2, requiredDocumentsTotal: 3 };
    expect(computeProfileCompletion(partial)).toBe(computeProfileCompletion({ ...FULL, requiredDocumentsUploaded: 0 }));
  });

  it('وصف فارغ لا يُحتسب — ولا حدّ أدنى لطوله بعد ذلك', () => {
    expect(computeProfileCompletion({ ...FULL, bio: '' })).toBeLessThan(100);
    // «قصير» صار مقبولًا: الحدّ الأدنى للطول أُزيل
    expect(computeProfileCompletion({ ...FULL, bio: 'قصير' })).toBe(100);
  });

  it('مهنة بلا مستندات إلزامية لا تمنح درجة المستندات مجانًا', () => {
    // requiredDocumentsTotal = 0 يعني أننا لا نعرف شيئًا نتحقق منه
    const noRequirements = { ...FULL, requiredDocumentsTotal: 0, requiredDocumentsUploaded: 0 };
    expect(computeProfileCompletion(noRequirements)).toBeLessThan(100);
  });
});

/* ================================================================== */
/* حارس استقبال الطلبات                                                 */
/* ================================================================== */

describe('حارس استقبال الطلبات', () => {
  it('المعتمد النشط وحده يستقبل الطلبات', () => {
    expect(canAcceptOrders({ verification: { status: 'APPROVED' }, isActive: true })).toBe(true);
  });

  it('كل حالة أخرى ممنوعة', () => {
    for (const status of VERIFICATION_STATUSES) {
      if (status === 'APPROVED') continue;
      expect(canAcceptOrders({ verification: { status }, isActive: true }), status).toBe(false);
    }
  });

  it('معتمد لكن موقوف (isActive = false) ممنوع أيضًا', () => {
    expect(canAcceptOrders({ verification: { status: 'APPROVED' }, isActive: false })).toBe(false);
  });

  it('الحارس يرمي 403 برسالة عربية واضحة', () => {
    expect(() =>
      assertCanAcceptOrders({ verification: { status: 'PENDING_REVIEW' }, isActive: false })
    ).toThrowError(/اعتماد حسابك/);

    expect(() =>
      assertCanAcceptOrders({ verification: { status: 'APPROVED' }, isActive: true })
    ).not.toThrow();
  });
});

/* ================================================================== */
/* مخططات الخطوات                                                      */
/* ================================================================== */

const VALID_STEP1 = {
  fullName: 'محمد عبد الرحمن',
  phone: '01012345678',
  email: 'p@example.com',
  password: 'Provider12345',
  confirmPassword: 'Provider12345',
  city: 'الفيوم',
  addressLine: 'شارع الحرية، بجوار مسجد النور',
};

const VALID_STEP2 = {
  categoryId: '507f1f77bcf86cd799439011',
  professionId: '507f1f77bcf86cd799439012',
  yearsOfExperience: 8,
  bio: 'سبّاك صحي بخبرة في كشف التسربات وتركيب السخانات.',
  coverageAreas: ['حي الجامعة'],
};

describe('الخطوة 1/3 — البيانات الأساسية', () => {
  it('تقبل البيانات الصحيحة وتطبّع الهاتف إلى E.164', () => {
    const result = providerStep1Schema.parse(VALID_STEP1);
    expect(result.phone).toBe('+201012345678');
    expect(result.governorate).toBe('الفيوم');
    expect(result.accountType).toBe('INDIVIDUAL');
  });

  it('البريد إلزامي — بعكس تسجيل العميل', () => {
    const { email: _email, ...withoutEmail } = VALID_STEP1;
    expect(providerStep1Schema.safeParse(withoutEmail).success).toBe(false);
  });

  it('ترفض كلمتي مرور غير متطابقتين', () => {
    const result = providerStep1Schema.safeParse({
      ...VALID_STEP1,
      confirmPassword: 'Another12345',
    });
    expect(result.success).toBe(false);
  });

  it('ترفض مدينة خارج مراكز الفيوم', () => {
    expect(providerStep1Schema.safeParse({ ...VALID_STEP1, city: 'الجيزة' }).success).toBe(false);
  });

  it('ترفض عنوانًا تفصيليًا قصيرًا أو أطول من 100 حرف', () => {
    expect(providerStep1Schema.safeParse({ ...VALID_STEP1, addressLine: 'ش' }).success).toBe(false);
    expect(
      providerStep1Schema.safeParse({ ...VALID_STEP1, addressLine: 'ا'.repeat(101) }).success
    ).toBe(false);
  });

  it('ترفض عمرًا أقل من 18 سنة', () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 10);
    const birthDate = recent.toISOString().slice(0, 10);

    expect(providerStep1Schema.safeParse({ ...VALID_STEP1, birthDate }).success).toBe(false);
  });

  it('ترفض أي مفتاح غير معرّف', () => {
    expect(providerStep1Schema.safeParse({ ...VALID_STEP1, role: 'ADMIN' }).success).toBe(false);
  });
});

describe('الخطوة 2/3 — المهنة والخدمة', () => {
  it('تقبل البيانات الصحيحة', () => {
    expect(providerStep2Schema.safeParse(VALID_STEP2).success).toBe(true);
  });

  it('تشترط منطقة تغطية واحدة على الأقل', () => {
    expect(providerStep2Schema.safeParse({ ...VALID_STEP2, coverageAreas: [] }).success).toBe(false);
  });

  it('ترفض منطقة خارج قائمة الفيوم — لا إحداثيات ولا نطاق', () => {
    expect(
      providerStep2Schema.safeParse({ ...VALID_STEP2, coverageAreas: ['المهندسين'] }).success
    ).toBe(false);
  });

  it('ترفض أي مفتاح سعر — التسعير أُزيل من المخطط', () => {
    expect(
      providerStep2Schema.safeParse({ ...VALID_STEP2, priceMode: 'RANGE' }).success
    ).toBe(false);
    expect(
      providerStep2Schema.safeParse({ ...VALID_STEP2, priceMin: 100, priceMax: 500 }).success
    ).toBe(false);
    expect(
      providerStep2Schema.safeParse({ ...VALID_STEP2, highlights: ['ميزة'] }).success
    ).toBe(false);
  });

  it('تقبل أي طول للوصف حتى 300 حرفًا — لا حدّ أدنى', () => {
    expect(providerStep2Schema.safeParse({ ...VALID_STEP2, bio: '' }).success).toBe(true);
    expect(providerStep2Schema.safeParse({ ...VALID_STEP2, bio: 'قصير' }).success).toBe(true);
    expect(providerStep2Schema.safeParse({ ...VALID_STEP2, bio: 'ا'.repeat(301) }).success).toBe(
      false
    );
  });
});

describe('مخطط التسجيل الكامل', () => {
  it('يجمع الخطوتين ويرفض أي مفتاح ثالث', () => {
    expect(
      registerProviderSchema.safeParse({ step1: VALID_STEP1, step2: VALID_STEP2 }).success
    ).toBe(true);

    expect(
      registerProviderSchema.safeParse({
        step1: VALID_STEP1,
        step2: VALID_STEP2,
        isVerifiedBadge: true,
      }).success
    ).toBe(false);
  });
});

/* ================================================================== */
/* التعديل والقرارات                                                   */
/* ================================================================== */

describe('مخطط تعديل الملف', () => {
  it('يقبل تعديلًا جزئيًا', () => {
    expect(updateProviderProfileSchema.safeParse({ yearsOfExperience: 12 }).success).toBe(true);
  });

  it('يرفض جسمًا فارغًا', () => {
    expect(updateProviderProfileSchema.safeParse({}).success).toBe(false);
  });

  it('لا يحوي أي حقل توثيق — أي محاولة لتمريره تُرفض', () => {
    for (const body of [
      { verification: { status: 'APPROVED' } },
      { isVerifiedBadge: true },
      { isActive: true },
      { profileCompletion: 100 },
      { role: 'ADMIN' },
      { ratingAvg: 5 },
    ]) {
      expect(updateProviderProfileSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});

describe('مخطط قرار التوثيق', () => {
  it('يقبل الاعتماد بلا سبب', () => {
    expect(verificationDecisionSchema.safeParse({ status: 'APPROVED' }).success).toBe(true);
  });

  it('يشترط السبب عند الرفض وعند طلب إعادة الإرسال', () => {
    expect(verificationDecisionSchema.safeParse({ status: 'REJECTED' }).success).toBe(false);
    expect(
      verificationDecisionSchema.safeParse({ status: 'RESUBMISSION_REQUIRED' }).success
    ).toBe(false);

    expect(
      verificationDecisionSchema.safeParse({ status: 'REJECTED', reason: 'مستند غير واضح' }).success
    ).toBe(true);
  });

  it('لا يقبل DRAFT ولا PENDING_REVIEW كقرار', () => {
    expect(verificationDecisionSchema.safeParse({ status: 'DRAFT' }).success).toBe(false);
    expect(verificationDecisionSchema.safeParse({ status: 'PENDING_REVIEW' }).success).toBe(false);
  });
});

describe('مخطط طابور الإدارة', () => {
  it('الحالة الافتراضية هي قيد المراجعة', () => {
    expect(adminProvidersQuerySchema.parse({}).status).toBe('PENDING_REVIEW');
  });

  it('يقبل كل الحالات المعرّفة ويرفض غيرها', () => {
    for (const status of VERIFICATION_STATUSES) {
      expect(adminProvidersQuerySchema.safeParse({ status }).success, status).toBe(true);
    }
    expect(adminProvidersQuerySchema.safeParse({ status: 'UNKNOWN' }).success).toBe(false);
  });
});
