const fs=require('node:fs'); const path=require('node:path');
const raiz=path.resolve(__dirname,'..'); const salida=path.resolve(raiz,'dist');
if(path.dirname(salida)!==raiz || path.basename(salida)!=='dist') throw Error('Ruta de compilación inesperada');
fs.rmSync(salida,{recursive:true,force:true});
