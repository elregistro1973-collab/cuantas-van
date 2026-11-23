const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
for(const name of ['index.html','styles.css','app.js','portrait.js','recognition-core.js','recognition.js','updates.js','manifest.webmanifest','icons'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
