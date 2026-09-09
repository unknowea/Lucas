import io

path = 'static/js/script.js'
src = io.open(path, encoding='utf-8', newline='').read()

start = src.find('        // plain text with **bold** and `code`')
assert start != -1, 'comment not found'

endmark = '    }\n    });\n}\n'
end = src.find(endmark, start)
assert end != -1, 'function end not found'
end += len(endmark)

old_block = src[start:end]
assert 'flushBuffer' not in old_block

new_block = '''        // plain text; lines starting with IMAGE:: render as images
        const lines = part.split("\\n");
        let buffer = "";

        const flushBuffer = ()=>{
            if(buffer.trim() === "") return;

            const p = document.createElement("p");
            const tokens =
                buffer.split(/(\\*\\*[^*]+\\*\\*|`[^`]+`)/g);

            tokens.forEach(token=>{
                if(!token) return;

                if(token.startsWith("**")){
                    const b = document.createElement("strong");
                    b.textContent = token.slice(2,-2);
                    p.appendChild(b);
                }
                else if(token.startsWith("`")){
                    const c = document.createElement("code");
                    c.textContent = token.slice(1,-1);
                    p.appendChild(c);
                }
                else{
                    p.appendChild(
                        document.createTextNode(token)
                    );
                }
            });

            container.appendChild(p);
            buffer = "";
        };

        lines.forEach(line=>{
            const t = line.trim();

            if(t.startsWith("IMAGE::")){
                flushBuffer();

                const img = document.createElement("img");
                img.src = "/" + t.slice(7).trim();
                img.alt = "Generated image";
                img.classList.add("chat-image");
                container.appendChild(img);
            }
            else{
                buffer += line + "\\n";
            }
        });

        flushBuffer();
    }
    });
}
'''

src = src[:start] + new_block + src[end:]

io.open(path, 'w', encoding='utf-8', newline='').write(src)
print('markdown renderer patched')
