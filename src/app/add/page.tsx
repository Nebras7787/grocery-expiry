'use client';
import { QuickBatchForm } from '@/components/batch-form/QuickBatchForm';
import { useRouter } from 'next/navigation';

export default function AddPage() {
  const router = useRouter();
  return (
    <main className="max-w-xl mx-auto space-y-4">
      <h2 className="text-lg font-semibold">إضافة دفعة</h2>
      <p className="text-sm text-slate-500">مصمّمة للإدخال السريع بيد واحدة على الجوال — اختر القسم وحدّد تاريخ الانتهاء من الأزرار السريعة.</p>
      <QuickBatchForm onSuccess={() => router.push('/')} />
    </main>
  );
}
