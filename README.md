# OSM Quick POI

外出先で、OpenStreetMapへ登録するPOIの位置を素早く正確に決めるためのiPhone向けPWAです。現在は **Phase 1**（OSM地図、現在地、中央固定ピン）のみ実装しています。

## 技術構成

TypeScript、Leaflet、Vite、Vitestを使用します。この規模ではUIフレームワークを使わない方が、地図・測位・状態管理の責務を小さく保てるため、素のTypeScriptを選びました。現在地は端末内でのみ利用し、永続保存や外部送信はしません（OSMタイル取得時には通常のWebリクエストが発生します）。

## ローカル実行

Node.js 22以降を用意し、次を実行します。

```sh
npm ci
npm run dev
```

位置情報はHTTPSまたは `localhost` の安全なコンテキストでのみ利用できます。

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

## GitHub Pages

`.github/workflows/deploy-pages.yml` が `main` へのpush時にlint、型検査、テスト、ビルドを通し、成功した成果物だけを公開します。ViteはGitHub Actionsの `GITHUB_REPOSITORY` からリポジトリ名を取得し、サブパス用のbase URLを設定します。

人間側で必要な初期設定：

1. GitHubで空のリポジトリを作成し、このローカルリポジトリへremoteを設定してpushする。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。
3. Actionsの初回デプロイ完了後、公開URLをiPhone Safariで開く。

## iPhoneのホーム画面へ追加

Safariで公開URLを開き、共有ボタンから「ホーム画面に追加」を選びます。位置情報を求められたら許可してください。拒否・タイムアウト・非対応の場合も、地図は手動操作できます。「現在地」は保存座標ではなく、その都度新しく測位します。

## Phase 1の制限

- オフライン地図には対応しません。Service WorkerはOSMタイルをキャッシュしません。
- 周辺POI検索、OSMログイン・書き込み、コンビニ登録、履歴・下書きは未実装です。
- iPhone実機でのSafari/PWA動作は、実際の端末で別途確認が必要です。

実機確認では、位置情報の許可・拒否・再試行、1本指パン、ピンチズーム、中央ピンの位置、Safe Area、ホーム画面起動、機内モード時の非クラッシュを確認してください。

詳しい段階計画は [ROADMAP.md](ROADMAP.md) を参照してください。
