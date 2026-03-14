import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
// Sử dụng SECRET_KEY từ biến môi trường hoặc dùng mặc định 32 ký tự (chính xác 32 bytes)
const SECRET_KEY = process.env.AES_SECRET_KEY; // 32 bytes

/**
 * Mã hóa chuỗi văn bản bằng AES-256-CBC
 * @param {string} text - Văn bản cần mã hóa
 * @returns {string} - Chuỗi mã hóa (IV + encrypted data dạng hex)
 */
export const encryptAES = (text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, "utf-8"), iv);
    let encrypted = cipher.update(text, "utf-8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
};

/**
 * Giải mã chuỗi đã mã hóa bằng AES-256-CBC
 * @param {string} encryptedText - Chuỗi mã hóa
 * @returns {string|null} - Văn bản gốc hoặc null nếu giải mã lỗi
 */
export const decryptAES = (encryptedText) => {
    try {
        const textParts = encryptedText.split(":");
        if (textParts.length !== 2) return null;
        
        const iv = Buffer.from(textParts[0], "hex");
        const encryptedData = Buffer.from(textParts[1], "hex");
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, "utf-8"), iv);
        
        let decrypted = decipher.update(encryptedData, "hex", "utf-8");
        decrypted += decipher.final("utf-8");
        return decrypted;
    } catch (error) {
        return null;
    }
};
