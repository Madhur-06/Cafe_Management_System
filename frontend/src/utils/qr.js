/* ==========================================================================
   QR Utility - real QR generation using qrcode
   ========================================================================== */

import QRCode from "qrcode";

function toUPILink({ upiId, payeeName = "POS Cafe", amount, currency = "INR" }) {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${Number(amount || 0).toFixed(2)}&cu=${encodeURIComponent(currency)}`;
}

async function drawQRCode(canvasElement, value, size) {
  await QRCode.toCanvas(canvasElement, value, {
    width: size,
    margin: 2,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

export async function generateUPIQR(
  canvasElement,
  { upiId, payeeName = "POS Cafe", amount, currency = "INR" }
) {
  if (!upiId) {
    throw new Error("UPI ID is required to generate the QR code");
  }
  const upiLink = toUPILink({ upiId, payeeName, amount, currency });
  await drawQRCode(canvasElement, upiLink, 280);
  return upiLink;
}

export async function generateTokenQR(canvasElement, tokenData) {
  const tokenValue =
    typeof tokenData === "string"
      ? tokenData
      : tokenData?.url || tokenData?.token || JSON.stringify(tokenData);
  await drawQRCode(canvasElement, tokenValue, 200);
  return tokenValue;
}
