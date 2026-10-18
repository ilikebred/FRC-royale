const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end('Not found')}
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(data)});
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
