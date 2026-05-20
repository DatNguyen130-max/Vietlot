# Nguồn dữ liệu JSONL (không nhầm branch)

Dashboard chỉ hiển thị **đúng dữ liệu trong Supabase** sau khi bạn sync. Nguồn sync `source=github` đọc URL trong biến môi trường.

## Repo crawl khuyến nghị: `thanhnhu/vietlott`

- GitHub: https://github.com/thanhnhu/vietlott  
- **Nhánh mặc định: `master`** (không phải `main`).  
- File: `data/power655.jsonl`, `data/power645.jsonl`.

Trên Vercel đặt:

```text
GITHUB_JSONL_RAW_BASE=https://raw.githubusercontent.com/thanhnhu/vietlott/master/data
```

**Cấu hình Vercel:** ô **Key** = `GITHUB_JSONL_RAW_BASE`, ô **Value** = chỉ URL `https://raw.githubusercontent.com/.../data` — **không** dán cả dòng `GITHUB_JSONL_RAW_BASE=https://...` vào Value. Nếu dùng `GITHUB_POWER655_JSONL_URL`, Value chỉ là URL đến file (không có tên biến phía trước).

Kiểm tra nhanh trong trình duyệt (phải tải được text JSON, không 404):

- https://raw.githubusercontent.com/thanhnhu/vietlott/master/data/power655.jsonl  
- https://raw.githubusercontent.com/thanhnhu/vietlott/master/data/power645.jsonl  

## Nếu vẫn thấy “Latest draw” cũ (ví dụ chỉ tới tháng 2)

- Bạn đang trỏ `GITHUB_JSONL_RAW_BASE` sang **fork/repo khác** hoặc **sai branch** (`main` trong khi repo chỉ có `master`).  
- Sau khi sửa env, **Redeploy** Vercel rồi gọi sync:

```bash
curl -X POST "https://YOUR_DOMAIN/api/sync?game=all&source=github" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Top 5 bộ số gợi ý (6/55 và 6/45)

- Trên web: ô **Top tổ hợp gợi ý** mặc định **5**; có thể tăng tới 30.  
- API: `GET /api/predict?game=power655&top=5` (mặc định `model=inferential`; thêm `model=heuristic` cho Monte Carlo).

- **Inferential (mặc định):** `recommendedNumbers` = 6 số có phần dư Pearson dương lớn nhất (mô tả cửa sổ lookback); `topCombinations` = tổ hợp xuất hiện nhiều nhất trong lịch sử cửa sổ (kèm kỳ vọng đều `D/C(N,6)`).
- **Heuristic:** `recommendedNumbers` theo xác suất biên mô phỏng; `topCombinations` theo tần suất trong MC.
