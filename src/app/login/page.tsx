'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('lastLoginEmail') ?? '';
  });
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password);
      if (!result.error && typeof window !== 'undefined') {
        localStorage.setItem('lastLoginEmail', email);
      }
      if (result.error) setError(result.error);
      if (result.notice) setNotice(result.notice);
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
              {notice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">{notice}</div>
              )}

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'يرجى الانتظار...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
              </Button>
            </form>

            <div className="mt-3 text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                  setNotice('');
                }}
                className="text-emerald-600 hover:underline"
              >
                {mode === 'login' ? 'ليس لديك حساب؟ أنشئ حساباً' : 'لديك حساب بالفعل؟ سجّل الدخول'}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-400 text-center">
          يُشترط تسجيل الدخول. بعد الدخول تُحفظ جلستك وتعمل البيانات محلياً حتى دون اتصال، وتُزامَن مع Supabase عند عودة الشبكة.
        </p>
      </div>
    </div>
  );
}
