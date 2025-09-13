import React from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "機材リスト",
  description: "在庫とイベント管理"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">機材リスト</div>
            <nav className="nav">
              <Link href="/">🏠 ダッシュボード</Link>
              <Link href="/inventory">📦 機材一覧</Link>
              <Link href="/events">📅 イベント</Link>
              <Link href="/rentals">🚚 レンタル</Link>
              <Link href="/usages">📋 使用機材</Link>
            </nav>
          </aside>
          <main className="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
