import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Heading, Panel } from '@/features/market/ui';
import { pageHead } from '@/features/market/metadata';

export const Route = createFileRoute('/reset-password')({
  head: () => pageHead('Reset Password', 'Choose a new password for your QuantEdge research account.'),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) { setMessage('The passwords do not match.'); return; }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else {
      setMessage('Your password has been updated. Redirecting to your research workspace…');
      setTimeout(() => void navigate({ to: '/' }), 1200);
    }
    setBusy(false);
  };
  return <div className="max-w-lg mx-auto py-12"><Heading title="Choose a new password" description="Use at least eight characters for your QuantEdge account." /><Panel title="Account recovery" action={<KeyRound />}><form className="panel-body flex flex-col gap-4" onSubmit={submit}><label className="field">New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="field">Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{message && <div role="status" className="notice">{message}</div>}<Button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</Button></form></Panel><p className="mt-4 text-xs text-muted-foreground">Open the latest recovery link from your email before submitting this form.</p></div>;
}
