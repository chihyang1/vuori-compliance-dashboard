import json,re
from pathlib import Path
root=Path(__file__).resolve().parent
folders=[root/'feedback-reports',root]
files=[]
for folder in folders:
    if folder.exists(): files += list(folder.glob('Product Feedback *.pdf'))
seen=set(); reports=[]
months={'jan':'JANUARY','feb':'FEBRUARY','mar':'MARCH','apr':'APRIL','may':'MAY','jun':'JUNE','jul':'JULY','july':'JULY','aug':'AUGUST','sep':'SEPTEMBER','sept':'SEPTEMBER','oct':'OCTOBER','nov':'NOVEMBER','dec':'DECEMBER'}
order={'jan':1,'january':1,'feb':2,'february':2,'mar':3,'march':3,'apr':4,'april':4,'may':5,'jun':6,'june':6,'jul':7,'july':7,'aug':8,'august':8,'sep':9,'sept':9,'september':9,'oct':10,'october':10,'nov':11,'november':11,'dec':12,'december':12}
for f in files:
    if f.resolve() in seen: continue
    seen.add(f.resolve())
    stem=f.stem.replace('Product Feedback','',1).strip()
    y=re.search(r'(20\d{2})',stem)
    if not y: continue
    year=int(y.group(1)); before=stem[:y.start()].replace('+',' ').replace('-',' ')
    toks=re.findall(r'[A-Za-z]+',before)
    ms=[t for t in toks if t.lower() in order]
    if len(ms)<2: continue
    a,b=ms[0],ms[1]
    period=f'{a.title()}-{b.title()} {year}'
    label=f'{months.get(a.lower(),a.upper())} - {months.get(b.lower(),b.upper())} {year}'
    rel=f.relative_to(root).as_posix()
    reports.append({'period':period,'label':label,'title':'Product Feedback','pdf':rel,'sort':[year,order[a.lower()]]})
reports.sort(key=lambda x:x.pop('sort'))
(root/'feedback-reports.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print(f'Generated {len(reports)} reports')
