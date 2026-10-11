#!/usr/bin/env python3
"""Turn dist/ into one self-contained HTML fragment (JS + images inlined, no <html>/<head>/<body>).
Usage: npm run build && python3 scripts/make-single-file.py out.html"""
import base64, glob, mimetypes, re, sys

out = sys.argv[1] if len(sys.argv) > 1 else 'dist/single.html'
html = open('dist/index.html').read()
js = open(glob.glob('dist/assets/*.js')[0]).read().replace('</script', '<\\/script')
style = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
title = re.search(r'<title>(.*?)</title>', html).group(1)
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = re.sub(r'<script[^>]*></script>', '', body)

def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or ('image/webp' if path.endswith('.webp') else 'image/png')
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

imgs = {n: data_uri(f'public/img/{n}') for n in ['atlas.png', 'stand.png', 'crouch.webp']}
imgjs = 'window.__IMG=' + str({k: v for k, v in imgs.items()}).replace("'", '"') + ';'

page = f'<title>{title}</title>\n<style>:root{{color-scheme:dark}}\n{style}</style>\n{body}\n<script>{imgjs}</script>\n<script type="module">{js}</script>\n'
open(out, 'w').write(page)
print(out, round(len(page) / 1e6, 2), 'MB')
