# INSTALL runbook — Multilevel Number Indent

เอกสารนี้เขียนให้ AI agent หรือคนอ่านแล้วทำตามได้เลยบนเครื่องอื่น ไม่ต้องตีความ

## ไฟล์ในแพ็กเกจ

```
nested-outline-numbering/main.js          ตัว plugin (ไฟล์เดียวจบ ไม่ต้อง build)
nested-outline-numbering/manifest.json
nested-outline-numbering/styles.css
README.md                                 คู่มือใช้งานเต็ม
```

## สิ่งที่ต้องมี

- Obsidian 1.5.0 ขึ้นไป (ไม่ต้องมี Node, ไม่ต้อง npm install, ไม่มี dependency ภายนอก)
- สิทธิ์เขียนไฟล์ในโฟลเดอร์ vault

## ขั้นตอนติดตั้ง

### 1. หา path ของ vault

โฟลเดอร์ vault คือโฟลเดอร์ที่มี `.obsidian/` อยู่ข้างใน

```bash
# ตัวอย่างบน Windows (git-bash / MSYS)
VAULT="/d/path/to/your-vault"
ls -d "$VAULT/.obsidian" || echo "ไม่ใช่ vault"
```

### 2. ปิด Obsidian ให้สนิท

สำคัญ: ถ้าเปิดอยู่ Obsidian จะเขียน `community-plugins.json` ทับจากหน่วยความจำตอนปิด แล้วรายการที่เพิ่มจะหาย

```bash
tasklist | grep -i obsidian || echo "ปิดแล้ว"
```

### 3. คัดลอกไฟล์ plugin

```bash
PLUG="$VAULT/.obsidian/plugins/nested-outline-numbering"
mkdir -p "$PLUG"
cp nested-outline-numbering/main.js       "$PLUG/"
cp nested-outline-numbering/manifest.json "$PLUG/"
cp nested-outline-numbering/styles.css    "$PLUG/"
ls -la "$PLUG"
```

### 4. เพิ่ม id ลงรายการ plugin ที่เปิดใช้

ไฟล์ `$VAULT/.obsidian/community-plugins.json` ต้องมี `"nested-outline-numbering"` อยู่ในอาร์เรย์

```bash
python - "$VAULT" <<'PY'
import json, sys, os
path = os.path.join(sys.argv[1], ".obsidian", "community-plugins.json")
data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else []
if "nested-outline-numbering" not in data:
    data.append("nested-outline-numbering")
    json.dump(data, open(path, "w", encoding="utf-8"), indent=2)
print(json.dumps(data, indent=2))
PY
```

ถ้าไม่มี python ให้เปิดไฟล์ด้วย editor แล้วเพิ่มบรรทัด `"nested-outline-numbering"` เข้าไปในอาร์เรย์ (ระวังเครื่องหมายจุลภาค)

### 5. เปิด Obsidian แล้วตรวจสอบ

1. เปิด Obsidian
2. `Settings → Community plugins` ควรเห็น **Multilevel Number Indent** อยู่ในสถานะเปิด
3. ถ้าไม่เห็น ให้กดไอคอน reload ในหน้านั้น แล้ว enable เอง

## ตรวจสอบว่าทำงานจริง

สร้างโน้ตใหม่แล้วพิมพ์ 4 บรรทัดนี้

```
1. alpha
  1.1. beta
  1.2. gamma
2. delta
```

วาง cursor ที่บรรทัด `  1.2. gamma` แล้วกด `Tab` ต้องได้

```
1. alpha
  1.1. beta
    1.1.1. gamma
2. delta
```

กด `Shift + Tab` ต้องกลับมาเหมือนเดิม

ทดสอบชั้น 4 ขึ้นไป: พิมพ์

```
1. alpha
  1.1. beta
    1.1.1. gamma
      1) delta
      2) epsilon
```

วาง cursor ที่บรรทัด `      2) epsilon` แล้วกด `Tab` ต้องได้ `        1.1) epsilon` — ชั้น 4 ลงไปเริ่มนับใหม่และปิดด้วยวงเล็บ กด `Shift + Tab` ต้องกลับมาเป็น `      2) epsilon`

ทดสอบ cursor: วาง cursor ท้ายบรรทัด `2. ` แล้วกด `Tab` ต้องได้ `  1.1. |` คือ cursor อยู่ **หลัง** ตัวเลข ไม่ใช่ `  1.1|. `

ทดสอบ heading: พิมพ์ `# 1 A` และ `## 1.1 B` แล้ววาง cursor ที่บรรทัด `## 1.1 B` กด `Tab` ต้องกลายเป็น `### 1.1.1 B`

## ปุ่มที่ใช้

| ปุ่ม | บนบรรทัดเลขข้อความ | บนบรรทัด heading |
|---|---|---|
| `Tab` | ย่อลงหนึ่งชั้น พร้อมกิ่งลูก | เพิ่ม level ของ `#` + renumber |
| `Shift + Tab` | ถอยกลับหนึ่งชั้น | ลด level ของ `#` + renumber |
| `Enter` | รายการใหม่ระดับเดียวกัน | ปล่อยให้ Obsidian ทำงานปกติ |
| `Alt + ↑ / ↓` | สลับกับรายการข้างเคียงที่ระดับเดียวกัน | สลับทั้ง section ระดับเดียวกัน |

## คำสั่งใน Command Palette

`Number headings in note`, `Remove heading numbers`, `Renumber multilevel block`, `Insert multilevel numbering`, `Remove multilevel numbering`, `Normalize the outline`, `Turn the selection into a numbered outline`, `Cut the item with its subtree`, `Paste the cut item here`, `Move the item to a level`, `Copy as clean text`, `Save the selection as a clean note`, `Copy as formatted text`, `Copy as a real nested list`, `Continue numbering past this heading`, `Restart numbering at this heading`

รายละเอียดของแต่ละคำสั่งอยู่ที่ [README.th.md](README.th.md)

## ปัญหาที่อาจเจอ

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| ไม่เห็น plugin ใน Settings | ยังไม่ reload | ปิดเปิด Obsidian ใหม่ |
| เพิ่มในไฟล์แล้วหาย | Obsidian เปิดอยู่ตอนแก้ | ปิด Obsidian ก่อนแก้ไฟล์ |
| กด Tab บนบรรทัดเลขแล้วไม่ย่อ | เป็นรายการแรกของระดับนั้น ไม่มีพี่น้องให้ไปเป็นลูก | ถูกต้องตามดีไซน์ ให้ย่อรายการที่ 2 เป็นต้นไป |
| กด Tab บน heading แล้วไม่เปลี่ยน level | โน้ตยังไม่มีเลข heading | รันคำสั่ง `Number headings in note` ครั้งหนึ่งก่อน |
| ปุ่มไม่ทำงานเลย | มี plugin อื่นยึดปุ่มเดียวกันที่ capture phase | ปิด plugin นั้น (เช่น Nested Ordered Numbering, Heading Shifter) |

## ถอนการติดตั้ง

```bash
rm -rf "$VAULT/.obsidian/plugins/nested-outline-numbering"
```

แล้วลบ `"nested-outline-numbering"` ออกจาก `community-plugins.json`
