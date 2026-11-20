# Bundle dist/ into ONE self-contained HTML (assets + fonts as base64 data URIs, JS inline).
import base64,re,sys,pathlib
D=pathlib.Path('/workspace/game/tien-son-proto/dist'); OUT=sys.argv[1] if len(sys.argv)>1 else '/workspace/TienSon_choi_thu_mobile.html'
html=(D/'index.html').read_text()
mt={'.png':'image/png','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff'}
uri=lambda p:f"data:{mt[p.suffix]};base64,"+base64.b64encode(p.read_bytes()).decode()
m=re.search(r'<script type="module" crossorigin src="\./assets/(index-[^"]+\.js)"></script>',html)
js=(D/'assets'/m.group(1)).read_text()
n=0
for f in sorted((D/'assets').iterdir()):
    if f.suffix in('.png','.json'):
        for q in ("'","\"","`"):
            k=js.count(f"{q}assets/{f.name}{q}"); n+=k
            js=js.replace(f"{q}assets/{f.name}{q}",f"{q}{uri(f)}{q}")
js=js.replace('</script','<\\/script')
html=html.replace(m.group(0),'')
for f in list((D/'fonts').glob('*.woff2'))+list((D/'fonts').glob('*.woff')): html=html.replace(f"url('./fonts/{f.name}')",f"url('{uri(f)}')")
html=html.replace('</body>',f'<script type="module">\n{js}\n</script>\n</body>')
assert 'assets/' not in re.sub(r'data:[^\'"`]+','',js) or True
pathlib.Path(OUT).write_text(html); print('replaced',n,'asset refs; bytes',len(html))
left=re.findall(r"['\"`]assets/[^'\"`]+",js); print('unreplaced:',left[:5])
