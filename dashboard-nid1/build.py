import sys,json
src=lambda p:open('src/'+p,encoding='utf-8').read()
import base64
img='data:image/jpeg;base64,'+base64.b64encode(open('caramelle.jpg','rb').read()).decode()
logo='data:image/png;base64,'+base64.b64encode(open('logo.png','rb').read()).decode()
h=src('index.html').replace('/*IMG*/',':root{--img-caramelle:url('+img+');--img-logo:url('+logo+')}').replace('/*CSS*/',src('style.css')).replace('/*CORE*/',src('core.js')).replace('/*APP*/',src('app.js'))
import os; os.makedirs('dist',exist_ok=True)
open('dist/produzione.html','w',encoding='utf-8').write(h.replace('<!--DEMO-->',''))
import os
if not os.path.exists('model.json'):
    print('ok (senza anteprima)'); raise SystemExit
m=json.load(open('model.json'))
demo='<script>window.SMI_DEMO='+json.dumps(m,separators=(',',':'))+';</script>'
open('dist/anteprima.html','w',encoding='utf-8').write(h.replace('<!--DEMO-->',demo))
print('ok',len(h))
