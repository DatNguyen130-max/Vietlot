# Vietlott Internal Probability Dashboard

Trang để ước tính xác suất (Monte Carlo + thống kê lịch sử) cho **Power 6/55** và **Mega 6/45**, đồng bộ dữ liệu qua **Supabase**, nguồn JSONL **local** hoặc **GitHub raw** (repo crawl).

## Lịch kỳ quay (hiển thị “kỳ tiếp theo”)

- **Power 6/55:** Thứ Ba, Năm, Bảy (Asia/Ho_Chi_Minh).
- **Mega 6/45:** Thứ Tư, Sáu, Chủ nhật.

Ngày kỳ tiếp theo được suy ra từ **kỳ mới nhất trong DB** và **ngày hiện tại** giờ VN; nếu dữ liệu trễ so với thực tế, hệ thống lấy ngày quay định kỳ **đầu tiên ≥ hôm nay**.

Gợi ý bộ số **đổi theo dữ liệu lịch sử**: mỗi lần JSONL mới được đồng bộ vào Supabase (thủ công, cron, hoặc webhook), gọi lại `/api/predict` sẽ tính lại.

## Nguồn dữ liệu

| Nguồn | Khi nào dùng |
|--------|----------------|
| `source=local` | File trong repo: `data/power655.jsonl`, `data/power645.jsonl` (dev hoặc đã commit sẵn). |
| `source=github` | Raw JSONL trên GitHub; cấu hình `GITHUB_JSONL_RAW_BASE` hoặc URL từng file (khuyến nghị trên Vercel). |

Chi tiết nối repo crawl + Vercel: [docs/github-crawl-vercel.md](./docs/github-crawl-vercel.md).

## Triển khai nhanh

1. Chạy SQL trong `supabase/schema.sql`.
2. Tạo `.env` từ `.env.example` (thêm URL GitHub nếu dùng crawl).
3. Deploy lên Vercel; bật `CRON_SECRET` (khuyến nghị) và/hoặc `SYNC_TOKEN`.
4. Sync lần đầu:

```bash
# Từ GitHub raw (production)
curl -X POST "https://YOUR_DOMAIN/api/sync?game=all&source=github" \
  -H "Authorization: Bearer YOUR_CRON_OR_SYNC_TOKEN"

# Hoặc từ file local trong repo
curl -X POST "https://YOUR_DOMAIN/api/sync?game=all&source=local" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Env vars

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Bảo vệ API sync/manual (nếu đặt — nên bật trên production)
SYNC_TOKEN=change-me
CRON_SECRET=change-me

# Một trong hai cách (GitHub):
GITHUB_JSONL_RAW_BASE=https://raw.githubusercontent.com/USER/REPO/main/data
# GITHUB_POWER655_JSONL_URL=...
# GITHUB_POWER645_JSONL_URL=...
```

Vercel Cron dùng `CRON_SECRET`: không cần token trên query string; Vercel gửi header `Authorization: Bearer <CRON_SECRET>`.

## API

```http
GET /api/predict?game=power655&lookback=420&simulations=40000&top=12&recentWindow=60
GET /api/predict?game=power645&...

GET|POST /api/sync?game=all&source=local|github&token=...
POST /api/manual?token=...
```

Phản hồi `/api/predict` có thêm `nextDraw` (ngày kỳ dự kiến, thứ tiếng Việt, mô tả lịch).

## Nhập tay kỳ quay mới

Ví dụ Power 6/55:

```bash
curl -X POST "http://localhost:3000/api/manual?token=change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "game": "power655",
    "drawId": 1311,
    "drawDate": "2026-02-24",
    "numbers": [1,5,12,22,33,44],
    "bonus": 9,
    "jackpot2Value": 30000000000
  }'
```

Ví dụ Mega 6/45:

```bash
curl -X POST "http://localhost:3000/api/manual?token=change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "game": "power645",
    "drawId": 1476,
    "drawDate": "2026-02-24",
    "numbers": [2,8,19,21,34,45],
    "bonus": null,
    "jackpot2Value": null
  }'
```

## Ghi chú

- Mô hình chỉ mang tính thống kê tham khảo, không phải dự đoán kết quả quay hợp lệ.
- Với 6/55 có thể lưu thêm `jackpot2Value`.
- `SUPABASE_SERVICE_ROLE_KEY` phải là **service role** (server-side only).
