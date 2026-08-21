# pshare-share-mcp

MCP server cho phép **bất kỳ AI nào** (Claude Code, Claude Desktop, hoặc client MCP khác) upload file/folder
lên Pshare và nhận lại link share — y hệt thao tác tay: upload qua UI rồi bấm nút **Share** để copy link.

Không cần đăng nhập / token gì cả — nhất quán với kiến trúc hiện tại của Pshare (chính client web cũng
không xác thực thật, chỉ dùng một `X-Browser-Id` tự sinh).

> **Yêu cầu**: đã có sẵn 1 instance [Pshare](https://github.com/ntanhprt/Pshare) đang chạy — mặc định
> repo này trỏ tới `https://pshare.protontech.vn`. Repo này chỉ là MCP server gọi vào REST API của
> Pshare, không tự chạy Pshare.

## Tool cung cấp

### `pshare_upload`

| field | bắt buộc | mô tả |
|---|---|---|
| `paths` | ✅ | mảng đường dẫn tuyệt đối (file hoặc folder) trên máy đang chạy MCP server. Folder được upload đệ quy, giữ nguyên cấu trúc thư mục con. |
| `title` | ❌ | tiêu đề hiển thị trên card share |
| `senderName` | ❌ | tên người gửi hiển thị cho người nhận |
| `password` | ❌ | mật khẩu để mở link share |
| `description` | ❌ | mô tả hiển thị trên card share |
| `ttlMinutes` | ❌ | số phút link tồn tại; bỏ trống = không hết hạn |

Kết quả trả về: link share dạng `https://pshare.protontech.vn/?share=<N>` kèm số file và trạng thái password.

File > 90MB tự động chuyển sang chunked upload (giống hành vi upload LAN của client web), không cần
quan tâm thêm.

## Cài đặt

Chỉ cần clone repo này — **không cần tải cả Pshare về**:

```bash
git clone https://github.com/ntanhprt/Pshare-mcp.git
cd Pshare-mcp
pnpm install
pnpm build      # biên dịch ra dist/
```

## Cập nhật lên bản mới

```bash
cd Pshare-mcp
git pull
pnpm install
pnpm build
```

- Không cần chạy lại `claude mcp add` — path `dist/index.js` không đổi, Claude Code sẽ tự dùng bản build mới ở lần chạy kế tiếp.
- **Claude Code**: mở session mới (session đang chạy không tự nhận bản mới giữa chừng).
- **Claude Desktop**: khởi động lại app.
- Đang chạy transport HTTP (`pnpm start:http`)? Phải tắt process cũ và chạy lại lệnh đó để nhận code mới.

## Cấu hình (biến môi trường)

| biến | mặc định | mô tả |
|---|---|---|
| `PSHARE_BASE_URL` | `https://pshare.protontech.vn` | URL của Pshare server mà MCP sẽ gọi vào để upload/share |
| `PSHARE_MCP_HOST` | `0.0.0.0` | host bind khi chạy transport HTTP |
| `PSHARE_MCP_PORT` | `7317` | port khi chạy transport HTTP |
| `PSHARE_MCP_ALLOWED_HOSTS` | *(không đặt)* | danh sách host được phép, cách nhau bằng dấu phẩy, dùng để bật DNS-rebinding protection khi bind `0.0.0.0` |

> **Mặc định đã trỏ sẵn tới domain public thật `https://pshare.protontech.vn`** — dùng được từ bất kỳ
> máy nào, không cần cùng LAN, không cần localhost hay IP nội bộ. Link share trả về cho người dùng
> luôn dùng đúng giá trị `PSHARE_BASE_URL` này — **không đặt thành `localhost` hay IP LAN nội bộ**
> (ví dụ `192.168.x.x`), vì người nhận link ở máy khác sẽ không mở được. Chỉ đổi biến này nếu bạn có
> một instance Pshare khác (môi trường dev/test riêng) muốn trỏ tới.

## Chạy thử độc lập

```bash
# stdio (mặc định)
pnpm start

# HTTP/SSE — AI ở máy khác cũng gọi được
pnpm start:http
# → nghe tại http://<PSHARE_MCP_HOST>:<PSHARE_MCP_PORT>/mcp
```

---

## Hướng dẫn tích hợp cho dev khác

### 1. Dùng với Claude Code (transport stdio)

Sau khi clone + build (xem mục Cài đặt ở trên), từ trong thư mục `Pshare-mcp`:

```bash
claude mcp add pshare-share -- node "$(pwd)/dist/index.js"
```

Không cần truyền `PSHARE_BASE_URL` — mặc định đã trỏ đúng `https://pshare.protontech.vn`. Chỉ truyền
qua `-e` nếu muốn trỏ tới một instance Pshare khác:

```bash
claude mcp add pshare-share \
  -e PSHARE_BASE_URL=https://instance-khac.example.com \
  -- node "$(pwd)/dist/index.js"
```

Kiểm tra đã đăng ký:

```bash
claude mcp list
```

### 2. Dùng với Claude Desktop (transport stdio)

Mở file config (`~/Library/Application Support/Claude/claude_desktop_config.json` trên macOS,
`%APPDATA%\Claude\claude_desktop_config.json` trên Windows) và thêm:

```json
{
  "mcpServers": {
    "pshare-share": {
      "command": "node",
      "args": ["/đường/dẫn/tuyệt/đối/tới/Pshare-mcp/dist/index.js"]
    }
  }
}
```

Khởi động lại Claude Desktop để nhận tool `pshare_upload`.

### 3. Dùng qua HTTP/SSE (khi AI chạy ở máy khác)

Chạy server MCP ở bất kỳ máy nào gọi được ra internet tới `pshare.protontech.vn`:

```bash
pnpm start:http
```

Trên máy client (Claude Code, hoặc bất kỳ MCP client hỗ trợ HTTP transport nào), trỏ tới:

```
http://<IP-máy-chạy-mcp>:7317/mcp
```

Ví dụ với Claude Code:

```bash
claude mcp add --transport http pshare-share http://<IP-máy-chạy-mcp>:7317/mcp
```

### 4. Dùng với bất kỳ AI/agent framework nào khác

MCP là giao thức JSON-RPC chuẩn — bất kỳ client MCP nào (LangChain MCP adapter, custom agent, v.v.)
cũng kết nối được, chỉ cần:
- **stdio**: spawn lệnh `node dist/index.js` và giao tiếp qua stdin/stdout.
- **HTTP**: gọi `POST http://<host>:<port>/mcp` theo Streamable HTTP transport spec của MCP.

## Lưu ý bảo mật

MCP server này **không xác thực** — bất kỳ ai gọi được vào nó (qua stdio nếu có quyền chạy process,
hoặc qua HTTP nếu truy cập được vào host:port) đều có thể upload/share file lên Pshare thật. Điều này
nhất quán với chính Pshare (không có auth trên API upload/share), nhưng cần lưu ý khi mở transport HTTP
ra ngoài LAN.
