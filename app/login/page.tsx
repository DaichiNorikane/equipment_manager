"use client";

import AuthGate from "@/components/AuthGate";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="stack" style={{ maxWidth: 480 }}>
      <h2 className="page-title">ログイン</h2>
      <AuthGate>
        <div className="card">
          <p>ログイン済みです。必要なページへお戻りください。</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn" href="/inventory/add">機材の追加/在庫追加へ</Link>
            <Link className="btn" href="/">ダッシュボードへ</Link>
          </div>
        </div>
      </AuthGate>
    </div>
  );
}

