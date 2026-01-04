# 🏠 Ứng Dụng Quản Lý Việc Nhà

Ứng dụng web giúp quản lý việc nhà cho sinh viên ở trọ chung, với tính năng luân phiên tự động và lưu trữ dữ liệu 1 tháng.

## ✨ Tính Năng

- 📋 **Quản lý công việc**: Thêm, sửa, xóa các công việc nhà
- 👥 **Quản lý thành viên**: Quản lý danh sách người ở chung
- 🔄 **Luân phiên tự động**: Tự động chuyển sang người tiếp theo sau khi hoàn thành
- ✅ **Đánh dấu hoàn thành**: Theo dõi ai đã làm việc gì, lúc nào
- 📊 **Thống kê**: Xem số lần hoàn thành của từng người
- 📜 **Lịch sử**: Theo dõi lịch sử làm việc
- 🗓️ **Reset tự động**: Dữ liệu tự động reset sau mỗi tháng
- 💾 **Export/Import**: Sao lưu và khôi phục dữ liệu
- 📱 **Mobile-first**: Tối ưu cho điện thoại

## 🚀 Cách Sử Dụng

1. **Mở file `index.html`** trong trình duyệt (Chrome, Safari, Firefox...)

2. **Lần đầu tiên**:
   - App sẽ tự động tạo dữ liệu mẫu (Minh, Lan, Hùng)
   - Xóa dữ liệu mẫu và thêm thành viên thật trong phần **Cài Đặt**

3. **Thêm thành viên**:
   - Vào tab **⚙️ Cài Đặt**
   - Click **+ Thêm Thành Viên**
   - Nhập tên và icon (tùy chọn)

4. **Thêm công việc**:
   - Vào tab **⚙️ Cài Đặt**
   - Click **+ Thêm Công Việc**
   - Nhập tên, icon, và chu kỳ

5. **Hoàn thành công việc**:
   - Vào tab **📋 Công Việc**
   - Click nút **✓ Hoàn Thành** khi làm xong
   - Người tiếp theo sẽ tự động lên làm

6. **Xem thống kê**:
   - Vào tab **📊 Thống Kê**
   - Xem ai làm nhiều nhất trong tháng
   - Xem lịch sử gần đây

## 💾 Quản Lý Dữ Liệu

- **Lưu trữ**: Dữ liệu lưu trên trình duyệt (localStorage)
- **Reset hàng tháng**: Lịch sử tự động xóa đầu tháng mới
- **Export**: Sao lưu dữ liệu ra file JSON
- **Import**: Khôi phục dữ liệu từ file đã sao lưu

## 📱 Tối Ưu Cho Mobile

- Giao diện responsive, tự động điều chỉnh theo màn hình
- Nút bấm lớn, dễ chạm (min 44px)
- Thiết kế dark mode, tiết kiệm pin
- Smooth animations

## 🎨 Công Nghệ

- HTML5
- CSS3 (Glassmorphism, Dark Mode)
- Vanilla JavaScript (ES6+)
- localStorage API

## ⚙️ Reset Tháng Mới

App tự động phát hiện khi sang tháng mới và:
- ✅ Reset lịch sử hoàn thành
- ✅ Reset trạng thái "đã hoàn thành hôm nay"
- ✅ Giữ nguyên danh sách thành viên và công việc
- ✅ Giữ nguyên thứ tự luân phiên

## 📝 Lưu Ý

- Mỗi người nên dùng trình duyệt riêng hoặc share chung 1 thiết bị
- Nếu muốn sync giữa nhiều thiết bị: Export/Import dữ liệu
- Không xóa cache trình duyệt (sẽ mất dữ liệu)

## 🆘 Hỗ Trợ

Nếu gặp vấn đề:
1. Thử refresh lại trang (F5)
2. Kiểm tra console (F12) xem có lỗi không
3. Export dữ liệu trước khi reset

---

Made with ❤️ for students living together!
