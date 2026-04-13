import os, re, glob
for file in glob.glob('**/*.js', recursive=True) + glob.glob('**/*.py', recursive=True):
    if 'node_modules' in file: continue
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()
        paths = re.findall(r'[\'\"\`]([^\'\"\`\n]+[\\/][^\'\"\`\n]+|C:\\[^\'\"\`\n]+|c:/\\[^\'\"\`\n]+)[\'\"\`]', text)
        for p in paths:
            if p.startswith('http') or p.startswith('socket.io') or p.startswith('api/'): continue
            print(f'{file}: {p}')
