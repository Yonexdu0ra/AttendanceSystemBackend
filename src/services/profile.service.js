import {   profileRepository   } from "../repositories/index.js";
import {   NotFoundError, ConflictError   } from "../utils/errors.js";

// ─── Lấy profile theo userId ──────────────────────────────────────────────────
/**
 * Lấy profile của một người dùng theo userId.
 *
 * @param {string} userId - ID của người dùng
 * @returns {Promise<object>} Thông tin profile
 * @throws {Error} 404 nếu chưa có profile
 */
const getProfileByUserId = async (userId) => {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
        throw new NotFoundError("Không tìm thấy profile của người dùng");
    }
    return profile;
};

// ─── Lấy profile theo profileId ───────────────────────────────────────────────
/**
 * Lấy profile theo ID của chính profile.
 *
 * @param {string} id - ID của profile
 * @returns {Promise<object>} Thông tin profile
 * @throws {Error} 404 nếu không tìm thấy
 */
const getProfileById = async (id) => {
    const profile = await profileRepository.findById(id);
    if (!profile) {
        throw new NotFoundError("Không tìm thấy profile");
    }
    return profile;
};

// ─── Tạo mới profile ──────────────────────────────────────────────────────────
/**
 * Tạo mới profile cho một người dùng.
 * Kiểm tra xem người dùng đã có profile chưa để tránh tạo trùng.
 *
 * @param {object} dto - Dữ liệu tạo mới (CreateProfileDto)
 * @param {string} dto.userId   - ID người dùng
 * @param {string} dto.fullName - Họ và tên
 * @param {string} dto.address  - Địa chỉ
 * @param {string} [dto.bio]    - Giới thiệu bản thân
 * @returns {Promise<object>} Profile vừa được tạo
 * @throws {Error} 409 nếu người dùng đã có profile
 */
const createProfile = async (dto) => {
    const existing = await profileRepository.findByUserId(dto.userId);
    if (existing) {
        throw new ConflictError(
            "Người dùng đã có profile, vui lòng dùng chức năng cập nhật"
        );
    }

    return profileRepository.create(dto);
};

// ─── Cập nhật profile theo userId ────────────────────────────────────────────
/**
 * Cập nhật thông tin profile của người dùng theo userId.
 * Nếu chưa có profile thì tự động tạo mới (upsert).
 *
 * @param {string} userId - ID của người dùng
 * @param {object} dto    - Dữ liệu cập nhật (UpdateProfileDto)
 * @returns {Promise<object>} Profile sau khi cập nhật
 */
const updateProfile = async (userId, dto) => {
    const existing = await profileRepository.findByUserId(userId);

    if (!existing) {
        // Tự động tạo mới nếu chưa có profile
        return profileRepository.create({ userId, ...dto });
    }

    return profileRepository.updateByUserId(userId, dto);
};

// ─── Xóa profile theo userId ──────────────────────────────────────────────────
/**
 * Xóa profile của một người dùng.
 *
 * @param {string} userId - ID của người dùng
 * @returns {Promise<object>} Profile vừa bị xóa
 * @throws {Error} 404 nếu không tìm thấy profile
 */
const deleteProfile = async (userId) => {
    const existing = await profileRepository.findByUserId(userId);
    if (!existing) {
        throw new NotFoundError("Không tìm thấy profile của người dùng");
    }

    return profileRepository.deleteByUserId(userId);
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const profileService = {
    getProfileByUserId,
    getProfileById,
    createProfile,
    updateProfile,
    deleteProfile,
};

