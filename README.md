# Quản lý giải đấu bóng đá

Công cụ quản lý giải bóng đá phong trào chạy hoàn toàn trên trình duyệt (HTML/CSS/JavaScript, không cần cài đặt).

## Cách chạy

Mở file `Frontend/index.html` bằng trình duyệt (Chrome, Cốc Cốc, Edge...). Dữ liệu được lưu trong trình duyệt của máy đang dùng.

## Chức năng

1. **Tạo giải đấu** — tên giải, logo, thời gian, sân bóng, banner, quản lý nhiều giải.
2. **Đội bóng** — mã đội, tên, logo, màu áo, khu vực, danh sách cầu thủ; nhập từ Excel.
3. **Thể thức** — vòng tròn (1 bảng hoặc chia bảng 4 đội...), vòng bảng + knock-out, loại trực tiếp, tùy chỉnh; bốc thăm ngẫu nhiên / hạt giống / theo khu vực.
4. **Lịch thi đấu** — tự xếp ngày, giờ, sân; kiểm tra trùng lịch; sửa lịch thủ công.
5. **Kết quả** — tỉ số, luân lưu, người ghi bàn, thẻ phạt, hoãn trận.
6. **Tự động cập nhật** — bảng xếp hạng, nhánh knock-out, vua phá lưới, thẻ phạt và án treo giò.
7. **Truyền thông** — soạn bài đăng Facebook/Zalo, thông báo, poster trận đấu (PNG), giao diện TV trình chiếu.
8. **Giao diện công khai** — xuất 1 file HTML cho khán giả xem lịch, kết quả, bảng xếp hạng.
9. **Xuất dữ liệu** — Excel, PDF, sao lưu/khôi phục (.json), sao lưu tự động.
10. **Cài đặt** — logo đơn vị, màu giao diện, quy tắc tính điểm, tài khoản & phân quyền.

## Cấu trúc thư mục

```
Frontend/
  index.html        Trang chính
  css/style.css     Giao diện
  js/logic.js       Chia bảng, xếp lịch, bảng xếp hạng, treo giò, kiểm tra trùng lịch
  js/app.js         Giao diện và các chức năng
  js/public.js      Tạo trang công khai cho khán giả
Admin/              (dành cho phần quản trị sau này)
```

## Thư viện dùng qua CDN (cần có mạng)

- Font Awesome 6.5.2 — biểu tượng
- SheetJS (xlsx) 0.18.5 — nhập/xuất Excel
- Google Fonts: Be Vietnam Pro, Barlow Condensed
