package vn.goihue;

import java.nio.charset.StandardCharsets;

/**
 * Builds VietQR payload strings locally per the EMVCo merchant-presented
 * specification (NAPAS transfer-to-account, service QRIBFTTA).
 * No external QR service is involved: the payload is a plain string and
 * any banking app can read it once rendered as a QR image by the frontend.
 */
public final class VietQr {
    private VietQr() {}

    static String tlv(String id, String value) {
        return id + String.format("%02d", value.length()) + value;
    }

    /** Dynamic payload: amount and transfer content (order number) are embedded. */
    public static String payload(String bankBin, String account, String merchantName, long amount, String content) {
        String consumer = tlv("00", bankBin) + tlv("01", account);
        String merchantAccount = tlv("00", "A000000727") + tlv("01", consumer) + tlv("02", "QRIBFTTA");
        StringBuilder body = new StringBuilder();
        body.append(tlv("00", "01"));            // payload format indicator
        body.append(tlv("01", "12"));            // dynamic QR
        body.append(tlv("38", merchantAccount)); // NAPAS merchant account info
        body.append(tlv("53", "704"));           // currency VND
        if (amount > 0) body.append(tlv("54", Long.toString(amount)));
        body.append(tlv("58", "VN"));            // country
        body.append(tlv("59", merchantName));    // merchant name (ASCII, max 25)
        body.append(tlv("62", tlv("08", content))); // additional data: transfer content
        String base = body + "6304";             // CRC placeholder id+length
        return base + crc16(base);
    }

    /** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 uppercase hex chars. */
    static String crc16(String s) {
        int crc = 0xFFFF;
        for (byte b : s.getBytes(StandardCharsets.US_ASCII)) {
            crc ^= (b & 0xFF) << 8;
            for (int i = 0; i < 8; i++) {
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
                crc &= 0xFFFF;
            }
        }
        return String.format("%04X", crc);
    }
}
