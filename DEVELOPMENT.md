# Development

## 責務

- `src/map`: Leafletの生成と地図中心変更通知
- `src/app`: 登録予定座標、ズーム、最終測位結果、UI状態の一元管理
- `src/geolocation`: Geolocation API境界、利用者向けエラー、再入防止
- `src/components`: DOM構築と表示整形
- `src/config`: Phase 1の設定値
- `src/pwa`: Service Worker登録

地図中心が将来の登録座標です。Leafletの `moveend` / `zoomend` 後に `map.getCenter()` とズームを読み、そこからだけストアを更新します。現在地取得に失敗した場合は中心とズームを更新しません。初回測位は既定ズーム、現在地ボタンからの再測位は操作中のズームを維持します。

後続PhaseのOSMサービスは、地図や測位へ直接混ぜず独立した境界として追加します。Phase 1ではその空実装を作りません。現在地の永続化・外部送信は禁止です。
