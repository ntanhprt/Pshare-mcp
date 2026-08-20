# pshare-share-mcp

MCP server cho phép **bất kỳ AI nào** (Claude Code, Claude Desktop, hoặc client MCP khác) upload file/folder
lên Pshare và nhận lại link share — y hệt thao tác tay: upload qua UI rồi bấm nút **Share** để copy link.

Không cần đăng nhập / token gì cả — nhất quán với kiến trúc hiện tại của Pshare (chính client web cũng
không xác thực thật, chỉ dùng một `X-Browser-Id` tự sinh).

> **Yêu cầu**: đã có sẵn 1 instance [Pshare](https://github.com/ntanhprt/Pshare) đang chạy ở đâu đó
> (localhost hoặc trong LAN) — repo này chỉ là MCP server gọi vào REST API của Pshare, không tự chạy
> Pshare.

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

Kết quả trả về: link share dạng `http://<pshare-host>/?share=<N>` kèm số file và trạng thái password.

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

## Cấu hình (biến môi trường)

| biến | mặc định | mô tả |
|---|---|---|
| `PSHARE_BASE_URL` | `http://localhost:5173` | URL của Pshare server mà MCP sẽ gọi vào để upload/share |
| `PSHARE_MCP_HOST` | `0.0.0.0` | host bind khi chạy transport HTTP |
| `PSHARE_MCP_PORT` | `7317` | port khi chạy transport HTTP |
| `PSHARE_MCP_ALLOWED_HOSTS` | *(không đặt)* | danh sách host được phép, cách nhau bằng dấu phẩy, dùng để bật DNS-rebinding protection khi bind `0.0.0.0` |

> Nếu Pshare chạy ở máy/IP khác trong LAN (không phải localhost), luôn set `PSHARE_BASE_URL` trỏ đúng
> tới máy đó, ví dụ `PSHARE_BASE_URL=http://192.168.3.7:5173`.

## Chạy thử độc lập

```bash
# stdio (mặc định)
pnpm start

# HTTP/SSE — AI ở máy khác trong LAN cũng gọi được
pnpm start:http
# → nghe tại http://<PSHARE_MCP_HOST>:<PSHARE_MCP_PORT>/mcp
```

---

## Hướng dẫn tích hợp cho dev khác

### 1. Dùng với Claude Code (transport stdio — khuyên dùng khi AI chạy cùng máy/host với Pshare)

Sau khi clone + build (xem mục Cài đặt ở trên), từ trong thư mục `Pshare-mcp`:

```bash
claude mcp add pshare-share -- node "$(pwd)/dist/index.js"
```

Muốn trỏ tới Pshare ở máy khác, truyền env qua `-e`:

```bash
claude mcp add pshare-share \
  -e PSHARE_BASE_URL=http://192.168.3.7:5173 \
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
      "args": ["/đường/dẫn/tuyệt/đối/tới/Pshare-mcp/dist/index.js"],
      "env": {
        "PSHARE_BASE_URL": "http://localhost:5173"
      }
    }
  }
}
```

Khởi động lại Claude Desktop để nhận tool `pshare_upload`.

### 3. Dùng qua HTTP/SSE (khi AI chạy ở máy khác trong cùng LAN)

Chạy server MCP ở máy đang host Pshare (hoặc bất kỳ máy nào gọi được tới Pshare):

```bash
PSHARE_BASE_URL=http://localhost:5173 pnpm start:http
```

Trên máy client (Claude Code, hoặc bất kỳ MCP client hỗ trợ HTTP transport nào), trỏ tới:

```
http://<IP-máy-chạy-mcp>:7317/mcp
```

Ví dụ với Claude Code:

```bash
claude mcp add --transport http pshare-share http://192.168.3.7:7317/mcp
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
