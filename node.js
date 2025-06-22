const fs=require('fs');
const http=require('http');
const ejs=require('ejs');
const data=fs.readFileSync('index.ejs','utf8');
const server=http.createServer(
    (req,res)=>{
        res.setHeader('Content-Type','text/html');
        res.write(data);
        res.end();
    }
);
server.listen(3000);
console.log('server started!');
