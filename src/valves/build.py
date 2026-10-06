#!/usr/bin/env python3
"""Build the valves project pages.

  python3 src/valves/build.py

Writes:
  kkmc-valves-project.html                  online copy (fonts and PDF libraries load from the internet)
  offline/kkmc-valves-project-offline.html  fully offline copy (fonts and PDF libraries embedded)

The offline fonts and libraries are taken from offline/projects-plan-offline.html.
"""
import base64, json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
TITLE = 'توريد وتركيب محابس البنية التحتية – مدينة الملك خالد العسكرية'
FONTS_LINK = ('<link id="fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?'
              'family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Readex+Pro:wght@500;600;700&display=swap">')


def data_uri(name):
    return 'data:image/jpeg;base64,' + base64.b64encode((HERE / 'assets' / name).read_bytes()).decode()


def offline_parts():
    src = (ROOT / 'offline' / 'projects-plan-offline.html').read_text(encoding='utf-8')
    out = {}
    for tag, ident in (('style', 'fonts'), ('script', 'lib-h2c'), ('script', 'lib-jspdf')):
        m = re.search(r'<%s id="%s">(.*?)</%s>' % (tag, ident, tag), src, re.S)
        if not m:
            raise SystemExit('missing %s in offline source' % ident)
        out[ident] = m.group(0)
    return out


def page(fonts_html, libs_html):
    css = (HERE / 'app.css').read_text(encoding='utf-8')
    js = (HERE / 'data.js').read_text(encoding='utf-8') + '\n' + (HERE / 'app.js').read_text(encoding='utf-8')
    assets = json.dumps({'logo': data_uri('logo.jpg'), 'footer': data_uri('footer.jpg')})
    return ''.join([
        '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        '<title>%s</title>' % TITLE, fonts_html,
        '<style id="app-css">', css, '</style></head><body>',
        '<div id="app"></div><div id="print-root"></div><dialog id="dlg"></dialog>',
        '<script type="application/json" id="app-data"></script>',
        '<script type="application/json" id="assets">', assets, '</script>',
        libs_html,
        '<script id="app-js">', js, '</script></body></html>\n',
    ])


def main():
    online = ROOT / 'kkmc-valves-project.html'
    online.write_text(page(FONTS_LINK, ''), encoding='utf-8')
    parts = offline_parts()
    offline = ROOT / 'offline' / 'kkmc-valves-project-offline.html'
    offline.write_text(page(parts['fonts'], parts['lib-h2c'] + parts['lib-jspdf']), encoding='utf-8')
    for f in (online, offline):
        print('%s  %.0f KB' % (f.relative_to(ROOT), f.stat().st_size / 1024))


if __name__ == '__main__':
    main()
