import {   holidayRepository   } from "../repositories/index.js";
import {   buildOffsetClause, parseOffsetResult   } from "../utils/offset-pagination.js";
import {   parseCursorResult   } from "../utils/cursor-pagination.js";
import {   NotFoundError, ConflictError   } from "../utils/errors.js";

// ─── Lấy danh sách ngày lễ (offset pagination) ────────────────────────────────
/**
 * Lấy danh sách ngày lễ với offset pagination (dùng cho web).
 *
 * @param {object} options
 * @param {number}  [options.page=1]    - Trang hiện tại
 * @param {number}  [options.limit=20]  - Số bản ghi mỗi trang
 * @param {string}  [options.type]      - Lọc theo loại ngày lễ (HolidayType)
 * @param {boolean} [options.isPaid]    - Lọc theo trạng thái có lương
 * @param {string}  [options.startDate] - Lọc từ ngày (ISO string)
 * @param {string}  [options.endDate]   - Lọc đến ngày (ISO string)
 * @returns {Promise<object>} Danh sách ngày lễ kèm metadata phân trang
 */
const getHolidays = async ({
    page = 1,
    limit = 20,
    type,
    isPaid,
    startDate,
    endDate,
} = {}) => {
    const where = buildWhereClause({ type, isPaid, startDate, endDate });
    const { skip, take } = buildOffsetClause(page, limit);

    const [data, total] = await Promise.all([
        holidayRepository.findMany({ skip, take, where }),
        holidayRepository.count(where),
    ]);

    return parseOffsetResult(data, total, page, limit);
};

// ─── Lấy danh sách ngày lễ (cursor pagination) ────────────────────────────────
/**
 * Lấy danh sách ngày lễ với cursor pagination (dùng cho mobile).
 *
 * @param {object} options
 * @param {string}  [options.cursor]    - Con trỏ phân trang (id của bản ghi cuối)
 * @param {number}  [options.limit=20]  - Số bản ghi mỗi trang
 * @param {string}  [options.type]      - Lọc theo loại ngày lễ (HolidayType)
 * @param {boolean} [options.isPaid]    - Lọc theo trạng thái có lương
 * @param {string}  [options.startDate] - Lọc từ ngày (ISO string)
 * @param {string}  [options.endDate]   - Lọc đến ngày (ISO string)
 * @returns {Promise<{ data: object[], hasMore: boolean, nextCursor: string | null }>}
 */
const getHolidaysCursor = async ({
    cursor,
    limit = 20,
    type,
    isPaid,
    startDate,
    endDate,
} = {}) => {
    const where = buildWhereClause({ type, isPaid, startDate, endDate });

    const raw = await holidayRepository.findManyCursor({
        cursor,
        take: limit,
        where,
    });

    return parseCursorResult(raw, limit);
};

// ─── Lấy ngày lễ theo ID ──────────────────────────────────────────────────────
/**
 * Lấy chi tiết một ngày lễ theo ID.
 *
 * @param {string} id - ID của ngày lễ
 * @returns {Promise<object>} Thông tin ngày lễ
 * @throws {Error} Nếu không tìm thấy
 */
const getHolidayById = async (id) => {
    const holiday = await holidayRepository.findById(id);
    if (!holiday) {
        throw new NotFoundError("Không tìm thấy ngày lễ");
    }
    return holiday;
};

// ─── Lấy ngày lễ theo ngày cụ thể ────────────────────────────────────────────
/**
 * Lấy ngày lễ theo ngày cụ thể.
 *
 * @param {string | Date} date - Ngày cần kiểm tra
 * @returns {Promise<object | null>} Ngày lễ nếu có, null nếu không
 */
const getHolidayByDate = async (date) => {
    return holidayRepository.findByDate(date);
};

// ─── Lấy ngày lễ trong khoảng thời gian ──────────────────────────────────────
/**
 * Lấy tất cả ngày lễ trong một khoảng thời gian (không phân trang).
 *
 * @param {string | Date} startDate - Ngày bắt đầu
 * @param {string | Date} endDate   - Ngày kết thúc
 * @returns {Promise<object[]>} Danh sách ngày lễ
 */
const getHolidaysByRange = async (startDate, endDate) => {
    return holidayRepository.findByDateRange(startDate, endDate);
};

// ─── Kiểm tra một ngày có phải ngày lễ không ──────────────────────────────────
/**
 * Kiểm tra một ngày có phải là ngày lễ không.
 *
 * @param {string | Date} date - Ngày cần kiểm tra
 * @returns {Promise<boolean>}
 */
const isHoliday = async (date) => {
    const holiday = await holidayRepository.findByDate(date);
    return !!holiday;
};

// ─── Tạo mới ngày lễ ─────────────────────────────────────────────────────────
/**
 * Tạo một ngày lễ mới.
 * Kiểm tra trùng lặp ngày trước khi tạo.
 *
 * @param {object} dto - Dữ liệu tạo mới (CreateHolidayDto)
 * @returns {Promise<object>} Ngày lễ vừa tạo
 * @throws {Error} Nếu ngày đã tồn tại
 */
const createHoliday = async (dto) => {
    const existing = await holidayRepository.findByDate(dto.date);
    if (existing) {
        throw new ConflictError(
            `Ngày ${new Date(dto.date).toLocaleDateString("vi-VN")} đã có ngày lễ được đăng ký`
        );
    }

    return holidayRepository.create(dto);
};

// ─── Tạo nhiều ngày lễ cùng lúc ──────────────────────────────────────────────
/**
 * Tạo nhiều ngày lễ cùng lúc (bulk create).
 * Bỏ qua các bản ghi đã tồn tại theo ngày.
 *
 * @param {object[]} dtos - Mảng dữ liệu ngày lễ (CreateHolidayDto[])
 * @returns {Promise<{ count: number }>} Số bản ghi được tạo
 */
const createManyHolidays = async (dtos) => {
    return holidayRepository.createMany(dtos);
};

// ─── Cập nhật ngày lễ ────────────────────────────────────────────────────────
/**
 * Cập nhật thông tin một ngày lễ.
 * Kiểm tra tồn tại và trùng lặp ngày (nếu có thay đổi ngày).
 *
 * @param {string} id  - ID ngày lễ cần cập nhật
 * @param {object} dto - Dữ liệu cập nhật (UpdateHolidayDto)
 * @returns {Promise<object>} Ngày lễ sau khi cập nhật
 * @throws {Error} Nếu không tìm thấy hoặc ngày bị trùng
 */
const updateHoliday = async (id, dto) => {
    const existing = await holidayRepository.findById(id);
    if (!existing) {
        throw new NotFoundError("Không tìm thấy ngày lễ");
    }

    // Kiểm tra trùng ngày nếu có thay đổi trường date
    if (dto.date) {
        const sameDate = await holidayRepository.findByDate(dto.date);
        if (sameDate && sameDate.id !== id) {
            throw new ConflictError(
                `Ngày ${new Date(dto.date).toLocaleDateString("vi-VN")} đã có ngày lễ được đăng ký`
            );
        }
    }

    return holidayRepository.update(id, dto);
};

// ─── Xóa ngày lễ ─────────────────────────────────────────────────────────────
/**
 * Xóa một ngày lễ theo ID.
 *
 * @param {string} id - ID ngày lễ cần xóa
 * @returns {Promise<object>} Ngày lễ vừa bị xóa
 * @throws {Error} Nếu không tìm thấy
 */
const deleteHoliday = async (id) => {
    const existing = await holidayRepository.findById(id);
    if (!existing) {
        throw new NotFoundError("Không tìm thấy ngày lễ");
    }

    return holidayRepository.remove(id);
};

// ─── Helper: Build where clause ───────────────────────────────────────────────
/**
 * Tạo điều kiện lọc Prisma từ các tham số query.
 *
 * @param {object} filters
 * @param {string}  [filters.type]
 * @param {boolean} [filters.isPaid]
 * @param {string}  [filters.startDate]
 * @param {string}  [filters.endDate]
 * @returns {object} Prisma where clause
 */
const buildWhereClause = ({ type, isPaid, startDate, endDate } = {}) => {
    const where = {};

    if (type) where.type = type;
    if (isPaid !== undefined) where.isPaid = isPaid;
    if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
    }

    return where;
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const holidayService = {
    getHolidays,
    getHolidaysCursor,
    getHolidayById,
    getHolidayByDate,
    getHolidaysByRange,
    isHoliday,
    createHoliday,
    createManyHolidays,
    updateHoliday,
    deleteHoliday,
};

