import { defaultResponse } from '../../models/generic/response.js';
import axios from 'axios';
import type { Response } from 'express';

type Cookie = {
    name: string,
    value: string,
    expires?: Date,
}

export function sendSuccessResponse(res: Response, data: unknown, cookie?: Cookie) {
    if (cookie) {
        res.cookie(cookie.name, cookie.value, {
            httpOnly: false,
            secure: false,
            expires: cookie.expires,
        })
    }
    res.status(200).json({
        message: "successful",
        status: true,
        data: data
    });
}

export function sendErrorResponse(res: Response, error: unknown, status?: number) {
    res.status(status ?? 400).json({
        ...defaultResponse,
        errors: error,
        data: null,
    });
}

export function getErrorMessage(error: unknown, fallback = "Unknown Error"): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function getErrors(error: unknown, message?: string) {
    const err = axios.isAxiosError(error) ? (
        error.response?.data ?? error.message
    ) : (message ?? "Unkown Error")
    return err;
}