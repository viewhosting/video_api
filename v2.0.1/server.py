import http.server
import socketserver
import mimetypes

# Asegurar que el navegador entienda los archivos .wasm
mimetypes.add_type('application/wasm', '.wasm')

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS y Cache (SIN COOP/COEP para permitir assets externos)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Servidor iniciado en http://localhost:{PORT}")
    httpd.serve_forever()
