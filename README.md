# Vietlott Internal Probability Dashboard (Offline-first)

Trang nội bộ để ước tính xác suất thống kê dãy số cho kỳ quay kế tiếp.

Hỗ trợ:
- `Power 6/55` (`power655`)
- `Mega 6/45` (`power645`)

## Kiến trúc dữ liệu

- Nguồn dữ liệu khởi tạo: file offline trong repo:
  - `power655.jsonl` hoặc `data/power655.jsonl`
  - `power645.jsonl` hoặc `data/power645.jsonl`
- Không gọi API GitHub trong luồng sync chính.
- Từ sau khi khởi tạo, bạn có thể nhập tay từng kỳ quay qua UI hoặc API `/api/manual`.

## Triển khai nhanh

1. Chạy SQL trong `supabase/schema.sql`.
2. Tạo `.env` từ `.env.example`.
3. Push code lên GitHub và deploy lên Vercel.
4. Gọi sync local để nạp full dữ liệu offline:

```bash
curl -X POST "https://YOUR_VERCEL_DOMAIN/api/sync?game=all&source=local&token=change-me"
```

## Env vars

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SYNC_TOKEN=change-me
CRON_SECRET=change-me
```

## API

```http
GET /api/predict?game=power655&lookback=420&simulations=40000&top=12&recentWindow=60
GET /api/predict?game=power645&lookback=420&simulations=40000&top=12&recentWindow=60

GET|POST /api/sync?game=all&source=local&token=...
GET|POST /api/sync?game=power655&source=local&token=...
GET|POST /api/sync?game=power645&source=local&token=...

POST /api/manual?token=...
```

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

- Với 6/55, hệ thống hỗ trợ thêm trường `jackpot2Value` để bạn lưu giá trị Jackpot 2 phục vụ thống kê.
- `SUPABASE_SERVICE_ROLE_KEY` bắt buộc là service role key.
