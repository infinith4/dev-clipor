# SmartScreen警告解消: SignPath Foundation コード署名導入計画

## Context

CI/CD（GitHub Actions）でビルドした `clipor.exe` / MSI をユーザーが実行すると、Windows SmartScreen が「WindowsによってPCが保護されました」警告を表示する。原因はバイナリにコード署名がないため。SignPath Foundation（OSS向け無料）を利用してOVコード署名を導入し、この警告を解消する。

## 方針: SignPath Foundation

- **コスト**: 無料（OSSプロジェクト向け）
- **仕組み**: SignPath がHSM上のOV証明書でバイナリに署名。GitHub Actions と連携し、ビルド成果物を自動署名
- **制約**: 申請・審査が必要。SmartScreen信頼度はダウンロード数に応じて徐々に構築される

## 他の選択肢との比較

| 方式 | コスト | SmartScreen効果 | 備考 |
|---|---|---|---|
| **SignPath Foundation** | 無料 | 中（徐々に構築） | OSS向け。審査あり |
| Azure Trusted Signing | $9.99/月 | 高（MS自身のCA） | 最も効果的だがコスト発生 |
| Certum OSS証明書 | ~69EUR/年 | 中 | クラウドHSM版ならCI/CD可 |
| EV証明書 | $249-600/年 | 中（2024年3月以降） | 高コスト・効果は低下 |
| 自己署名 | 無料 | なし | SmartScreen効果ゼロ |
| 署名なし（現状） | 無料 | なし | 毎回警告が出る |

## 実装ステップ

### Step 1: SignPath 申請準備
- https://signpath.org/ でOSSプロジェクトとして申請
- リポジトリの公開設定・ライセンス・説明文が必要

### Step 2: tauri.conf.json の修正

**ファイル**: `clipor/src-tauri/tauri.conf.json`

`bundle.windows` セクションに `signCommand` を追加:

```json
"windows": {
  "digestAlgorithm": "sha256",
  "signCommand": "echo %1"
}
```

> SignPath は「ビルド後に成果物を送信して署名」方式のため、Tauri ビルド時の署名はスキップし、後続ステップで SignPath に送信する。`signCommand` に `echo %1` を設定してビルドエラーを回避するか、signCommand を設定せずにビルドし、後から署名する。

### Step 3: GitHub Actions ワークフローの修正

**ファイル**: `.github/workflows/build-clipor.yml`

Tauri ビルド後に SignPath へ署名リクエストを送信するステップを追加:

```yaml
# 既存の tauri-action ステップの後に追加
- name: Submit signing request to SignPath
  uses: signpath/github-action-submit-signing-request@v1
  with:
    api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
    organization-id: '<SignPath Org ID>'
    project-slug: 'clipor'
    signing-policy-slug: 'release-signing'
    artifact-configuration-slug: 'windows-installer'
    github-artifact-id: '<artifact-id>'
    wait-for-completion: true
    output-artifact-directory: 'signed-artifacts'
```

署名済み成果物を GitHub Release にアップロード:

```yaml
- name: Upload signed artifacts to release
  uses: softprops/action-gh-release@v2
  with:
    files: signed-artifacts/*
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 4: SignPath プロジェクト設定
- SignPath ダッシュボードで Artifact Configuration を作成（MSI / NSIS EXE を対象）
- Signing Policy を作成（release-signing）
- Trusted Build System として GitHub Actions を登録

### Step 5: GitHub Secrets の設定
- `SIGNPATH_API_TOKEN`: SignPath の API トークン

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `clipor/src-tauri/tauri.conf.json` | signCommand の追加（必要に応じて） |
| `.github/workflows/build-clipor.yml` | SignPath 署名ステップの追加 |

## 検証方法

1. テストタグをプッシュして GitHub Actions ワークフローを実行
2. SignPath ダッシュボードで署名リクエストの完了を確認
3. 署名済み EXE/MSI をダウンロード
4. ファイルのプロパティ → デジタル署名タブで署名を確認
5. クリーンな Windows マシンで実行し、SmartScreen 警告が出ないことを確認

## 注意事項

- SignPath 審査に数日〜数週間かかる可能性あり
- 審査通過前は実装の準備（ワークフロー変更）のみ先行可能
- SmartScreen 信頼度は署名後すぐに完全解消ではなく、ダウンロード数に応じて改善される
- 2024年3月以降、EV証明書でも即座のSmartScreen回避は保証されなくなった
