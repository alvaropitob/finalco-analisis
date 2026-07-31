import urllib.request
import re

url = 'https://finalco-analisis.vercel.app'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req) as res:
        html = res.read().decode('utf-8')
        m = re.search(r'src=\"(/assets/index-[^\"]*\.js)\"', html)
        if m:
            js_url = url + m.group(1)
            print('JS Bundle:', js_url)
            js_req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(js_req) as js_res:
                js = js_res.read().decode('utf-8')
                print('score_acierta_mas in bundle?', 'score_acierta_mas' in js)
                print('pct_endeudamiento in bundle?', 'pct_endeudamiento' in js)
except Exception as e:
    print('Error:', e)
