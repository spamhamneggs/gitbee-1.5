export interface APIResponse<T = unknown> {
    status: boolean
    message: string
    errors?: unknown
    data: T | null,
}

export const defaultResponse: APIResponse = {
    message: "failed",
    status: false,
    data: undefined,
};