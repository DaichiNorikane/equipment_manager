"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setMessage(error.message);
    else setMessage("ログイン用のメールを送信しました。メール内のリンクを開いてください。");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (!ready) return <div />;
  if (!session) {
    return (
      <div style={{ maxWidth: 420 }}>
        <h3>ログイン</h3>
        <p>メールアドレス宛にログインリンクを送信します。</p>
        <form onSubmit={signIn} style={{ display: 'grid', gap: 8 }}>
          <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit">ログインリンクを送信</button>
        </form>
        {message && <p>{message}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={signOut}>ログアウト</button>
      </div>
      {children}
    </div>
  );
}

