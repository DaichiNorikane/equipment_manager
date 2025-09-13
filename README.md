# 機材リスト（在庫・イベント管理）

機材をカテゴリで整理し、在庫とイベント利用を一元管理します。Vercelにデプロイ、データはSupabaseで共有（10名程度を想定）。

## 機能
- カテゴリ別/全体の機材参照（公開、ログイン不要）
- 機材プロパティ: カテゴリ, メーカー(必須), 型番(必須), 在庫数(必須), URL, 消費電力, 重量, サイズ, 単価, 原産国, 備考, 任意の追加属性(JSON)
- イベント(いつ/どこ/何を/何台)の記録
- 期間重複時の在庫不足チェック（必要追加数の算出）
- PC/スマホ対応の簡易UI（Next.js）

## 技術
- Next.js (App Router, TypeScript)
- Supabase (Postgres, Auth, RLS)
- デプロイ: Vercel

## セットアップ
1) Supabaseプロジェクトを作成し、`Project URL` と `anon key` を控える。
2) Supabase SQLエディタで以下のSQLを順に実行：
   - `supabase/sql/001_schema.sql`
   - `supabase/sql/002_policies.sql`
   - `supabase/sql/003_functions.sql`
3) `.env.local` を作成し、以下を設定：
```
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのanonKey
```

4) 依存関係をインストールしてローカル起動：
```
npm install
npm run dev
```

5) Vercelにデプロイ：
- リポジトリをGitHubなどにプッシュ
- VercelでImportし、環境変数に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定

## ページ構成（初期版）
- `/` ダッシュボード（近日のイベントと不足アラート）
- `/inventory` 機材一覧 + 追加
- `/events` イベント一覧 + 追加
- 重複チェックはイベント作成時・編集時に期間/数量から即時計算

## カスタム項目
- 機材の追加属性は `equipments.properties (JSONB)` に保存。任意のキー/値をUIから追加可能（後続で拡張）。

## 認証
- 公開デモ向けにRLSポリシーは anon でも読書き可能です。運用では制限を戻してください。

---
このリポジトリは最小構成です。必要に応じてUI/UXやワークフローを拡張していきましょう。
