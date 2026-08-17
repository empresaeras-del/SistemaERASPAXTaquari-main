import re

with open('src/utils/pix.ts', 'r') as f:
    content = f.read()

# remove import
content = re.sub(r"import \{ crc16ccitt \} from 'crc';\s*", "", content)

crc_fn = """function crc16ccitt(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}
"""

content = crc_fn + "\n" + content

# change call to return string
content = content.replace("crc16ccitt(payload).toString(16).toUpperCase().padStart(4, '0')", "crc16ccitt(payload)")

with open('src/utils/pix.ts', 'w') as f:
    f.write(content)
