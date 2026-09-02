function crc16ccitt(payload: string): string {
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

function formatEMV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function generatePixPayload(
  pixKey: string,
  merchantName: string,
  merchantCity: string,
  amount?: number,
  txid: string = '***'
): string {
  const payloadFormat = formatEMV('00', '01');
  
  const gui = formatEMV('00', 'br.gov.bcb.pix');
  const key = formatEMV('01', pixKey);
  const merchantAccountInfo = formatEMV('26', `${gui}${key}`);
  
  const merchantCategoryCode = formatEMV('52', '0000');
  const transactionCurrency = formatEMV('53', '986');
  
  let transactionAmount = '';
  if (amount !== undefined) {
    transactionAmount = formatEMV('54', amount.toFixed(2));
  }
  
  const countryCode = formatEMV('58', 'BR');
  
  // Max 25 chars for name
  const name = merchantName.substring(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const merchantNameEMV = formatEMV('59', name);
  
  // Max 15 chars for city
  const city = merchantCity.substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const merchantCityEMV = formatEMV('60', city);
  
  const txidEMV = formatEMV('05', txid);
  const additionalDataField = formatEMV('62', txidEMV);
  
  const payload = `${payloadFormat}${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${merchantNameEMV}${merchantCityEMV}${additionalDataField}6304`;
  
  const crc = crc16ccitt(payload);
  
  return `${payload}${crc}`;
}
