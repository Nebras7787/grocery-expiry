'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, LogIn, UserPlus, WifiOff } from 'lucide-react';
import { DemoDataCard } from '@/components/demo/DemoDataCard';

export default function LoginPage() {
  const { signIn, signUp, continueOffline } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password);
      if (result.error) setError(result.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center text-white">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">مدير انتهاء الصلاحية</h1>
          <p className="text-sm text-slate-500">تابع تواريخ الصلاحية بدون إنترنت • مع مزامنة تلقائية</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">البريد الإلكتروني</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-start"
                />
              </div>
              <div>
                <label className="text-sm font-medium">كلمة المرور</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  dir="ltr"
                  className="text-start"
                />
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
              )}

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'يرجى الانتظار...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
              </Button>
            </form>

            <div className="mt-3 text-center text-sm">
              <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-emerald-600 hover:underline">
                {mode === 'login' ? 'ليس لديك حساب؟ أنشئ حساباً' : 'لديك حساب بالفعل؟ سجّل الدخول'}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-50 px-2 text-slate-400">أو</span>
          </div>
        </div>

        <Button variant="outline" onClick={continueOffline} className="w-full">
          <WifiOff className="w-4 h-4 ms-2" />
          المتابعة بدون حساب
        </Button>
        <p className="text-xs text-slate-400 text-center">
          تُحفظ البيانات محلياً في جهازك. للمزامنة مع السحابة سجّل الدخول من Supabase.
        </p>

        {process.env.NODE_ENV !== 'production' && <DemoDataCard variant="box" />}
      </div>
    </div>
  );
}
