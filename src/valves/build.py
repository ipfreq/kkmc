#!/usr/bin/env python3
"""Build the valves project pages.

  python3 src/valves/build.py

Writes:
  kkmc-valves-project.html                  online copy (fonts and PDF/Excel libraries load from the internet)
  offline/kkmc-valves-project-offline.html  fully offline copy (fonts and PDF/Excel libraries embedded)

  python3 src/valves/build.py --desktop desktop/renderer
also writes the desktop program's project page (desktop/renderer/valves.html,
fully offline), plan-app.html (the offline lift-stations work-plan app), and
data.js, convert.js and fonts.css used by its projects home page.

  python3 src/valves/build.py --page OUT.html ADAPTER.html
also writes a page-content-only copy for publishing as a hosted page; the
adapter snippet (kept outside the repo) defines window.PLAN_HOST.

The offline fonts and libraries are taken from offline/projects-plan-offline.html.
"""
import base64, json, pathlib, re, sys

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


def app_js():
    app = (HERE / 'app.js').read_text(encoding='utf-8')
    marker = '/*@@MODULES@@*/'
    if app.count(marker) != 1:
        raise SystemExit('module marker missing in app.js')
    app = app.replace(marker, (HERE / 'storage.js').read_text(encoding='utf-8') + '\n' + (HERE / 'labor.js').read_text(encoding='utf-8'))
    return (HERE / 'data.js').read_text(encoding='utf-8') + '\n' + (HERE / 'convert.js').read_text(encoding='utf-8') + '\n' + app


def body(title, fonts_html, libs_html, extra=''):
    css = (HERE / 'app.css').read_text(encoding='utf-8')
    assets = json.dumps({'logo': data_uri('logo.jpg'), 'footer': data_uri('footer.jpg')})
    return ''.join([
        '<title>%s</title>' % title, fonts_html,
        '<style id="app-css">', css, '</style>',
        '<div id="app"></div><div id="print-root"></div><dialog id="dlg"></dialog>',
        '<script type="application/json" id="app-data"></script>',
        '<script type="application/json" id="assets">', assets, '</script>',
        libs_html, extra,
        '<script id="app-js">', app_js(), '</script>',
    ])


def page(fonts_html, libs_html, head_extra='', extra=''):
    return ('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="author" content="Yasser Mohamed Abdelgaber">'
            '<meta name="copyright" content="© 2026 Yasser Mohamed Abdelgaber. All rights reserved.">'
            + head_extra + '</head><body>' + body(TITLE, fonts_html, libs_html, extra) + '</body></html>\n')


def main():
    online = ROOT / 'kkmc-valves-project.html'
    online.write_text(page(FONTS_LINK, ''), encoding='utf-8')
    parts = offline_parts()
    offline = ROOT / 'offline' / 'kkmc-valves-project-offline.html'
    xlsx = '<script id="lib-xlsx">' + (HERE / 'vendor' / 'exceljs.min.js').read_text(encoding='utf-8') + '</script>'
    offline.write_text(page(parts['fonts'], parts['lib-h2c'] + parts['lib-jspdf'] + xlsx), encoding='utf-8')
    for f in (online, offline):
        print('%s  %.0f KB' % (f.relative_to(ROOT), f.stat().st_size / 1024))
    if '--desktop' in sys.argv:
        out = pathlib.Path(sys.argv[sys.argv.index('--desktop') + 1])
        out.mkdir(parents=True, exist_ok=True)
        csp = ('<meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; '
               'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:">')
        (out / 'valves.html').write_text(page(parts['fonts'], parts['lib-h2c'] + parts['lib-jspdf'] + xlsx, csp,
                                              '<script src="desktop-host.js"></script>'), encoding='utf-8')
        for f in ('data.js', 'convert.js'):
            (out / f).write_text((HERE / f).read_text(encoding='utf-8'), encoding='utf-8')
        (out / 'plan-app.html').write_text((ROOT / 'offline' / 'projects-plan-offline.html').read_text(encoding='utf-8'), encoding='utf-8')
        (out / 'fonts.css').write_text(re.sub(r'^<style id="fonts">|</style>$', '', parts['fonts']), encoding='utf-8')
        print('%s  %.0f KB' % (out / 'valves.html', (out / 'valves.html').stat().st_size / 1024))
    if '--page' in sys.argv:
        i = sys.argv.index('--page')
        out, adapter = pathlib.Path(sys.argv[i + 1]), pathlib.Path(sys.argv[i + 2]).read_text(encoding='utf-8')
        out.write_text(body('محابس البنية التحتية', FONTS_LINK, '', adapter), encoding='utf-8')
        print('%s  %.0f KB' % (out, out.stat().st_size / 1024))


if __name__ == '__main__':
    main()
