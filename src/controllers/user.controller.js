import {   userService   } from "../services/index.js";

// ─── GET /users ─────────────────────────────────────────────────────────────
export const list = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;
        const result = await userService.getUsers({
            page: Number(page),
            limit: Number(limit),
            role: role || undefined,
            search: search || undefined,
        });
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
};

// ─── GET /users/:id ─────────────────────────────────────────────────────────
export const getById = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json({ success: true, data: user });
    } catch (err) { next(err); }
};

// ─── POST /users ────────────────────────────────────────────────────────────
export const create = async (req, res, next) => {
    try {
        const user = await userService.createUser(req.body);
        res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
};

// ─── PUT /users/:id ─────────────────────────────────────────────────────────
export const update = async (req, res, next) => {
    try {
        const user = await userService.updateUser(req.params.id, req.body);
        res.json({ success: true, data: user });
    } catch (err) { next(err); }
};

// ─── DELETE /users/:id ──────────────────────────────────────────────────────
export const remove = async (req, res, next) => {
    try {
        await userService.deleteUser(req.params.id);
        res.json({ success: true, message: "Xóa người dùng thành công" });
    } catch (err) { next(err); }
};
