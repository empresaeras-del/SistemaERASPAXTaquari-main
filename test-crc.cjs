const { crc16ccitt } = require('crc');

function myCrc(payload) {
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

const p = "00020101021126330014br.gov.bcb.pix0111000000000005204000053039865802BR5907EMPRESA6009SAO PAULO62070503***6304";
console.log(crc16ccitt(p).toString(16).toUpperCase().padStart(4, '0'));
console.log(myCrc(p));

