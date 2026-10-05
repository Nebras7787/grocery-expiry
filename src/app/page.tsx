'use client';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { PriorityList } from '@/components/dashboard/PriorityList';
import { QuickBatchForm } from '@/components/batch-form/QuickBatchForm';
import { useEffect } from 'react';
import { checkAndNotifyExpiring, requestNotificationPermission } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

export default function DashboardPage() {
  useEffect(() => {
    checkAndNotifyExpiring();
  }, []);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">لوحة المعلومات</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const ok = await requestNotificationPermission();
            if (ok) await checkAndNotifyExpiring();
            else alert('لم يُسمح بالإشعارات');
          }}
        >
          <Bell className="w-4 h-4 ms-1" /> تفعيل التنبيهات
        </Button>
      </div>

      <SummaryCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PriorityList />
        </div>
        <div>
          <QuickBatchForm />
        </div>
      </div>
    </main>
  );
}
