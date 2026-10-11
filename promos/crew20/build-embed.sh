#!/bin/bash
# usage: ./build-embed.sh <version>   e.g. 10-07-26-02
set -e
V=$1; SRC=crew20-promo-sandbox-$V.js; OUT=crew20-promo-sandbox-EMBED-$V.html
acorn --ecma5 --silent $SRC
terser $SRC --compress --mangle --ecma 5 -o /tmp/c20.min.js
node -e '
const fs=require("fs"),[v,out,src]=process.argv.slice(1);let m=fs.readFileSync("/tmp/c20.min.js","utf8").trim();
const P="\"PASTE_PROMO_WEB_APP_EXEC_URL_HERE\"";if(m.split(P).length!==2)throw "url placeholder count";
m=m.replace(P,"\n"+P+" /* web app URL */\n");
const o="<!-- CREW20 promo "+v+" SANDBOX ONLY, Before </body>. Source: "+src+" -->\n<script>\n"+m+"\n</script>\n";
if(o.includes("</script",o.indexOf("<script>")+8)&&o.indexOf("</script")!==o.lastIndexOf("</script"))throw "nested script tag";
fs.writeFileSync(out,o);console.log(out,"chars",o.length);' $V $OUT $SRC
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");require("fs").writeFileSync("/tmp/embed-inner.js",s.split("<script>\n")[1].split("\n</script>")[0])' $OUT
acorn --ecma5 --silent /tmp/embed-inner.js && echo "ES5 OK (source + embed)"
