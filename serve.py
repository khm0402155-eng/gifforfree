import http.server
import socketserver

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
        ".html": "text/html",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
    }


if __name__ == "__main__":
    port = 8765
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        print(f"http://127.0.0.1:{port}")
        httpd.serve_forever()
