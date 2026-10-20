const getExploreData = async (path: string, params?: Record<string, string>) => {
  try {
    const api = process.env.NEXT_PUBLIC_BACKEND_API;
    if (!api) {
      throw new Error(
        "NEXT_PUBLIC_BACKEND_API is not configured. Set it and restart the frontend."
      );
    }

    const url = new URL(path, api.endsWith("/") ? api : `${api}/`);
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") ?? "unknown content type";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error(
        `${url.origin}${url.pathname} returned HTTP ${response.status} (${contentType}) instead of JSON. Check that the backend is running and NEXT_PUBLIC_BACKEND_API points to its /api/ URL.`
      );
    }

    const result = await response.json();
    if (!response.ok || !result.status) {
      const message = typeof result.errors === "string" ? result.errors : result.message;
      throw new Error(
        `${url.origin}${url.pathname} returned HTTP ${response.status}: ${message || "API request failed"}`
      );
    }
    return { success: true as const, data: result.data ?? [] };
  } catch (error: unknown) {
    console.warn(`Explore API request failed (${path}):`, error instanceof Error ? error.message : error);
    return { success: false as const, message: "Could not load data. Please try again." };
  }
};

export const getAllCategory = () => getExploreData("category/all");
export const getAllMajor = () => getExploreData("major/all");
export const getAllTech = () => getExploreData("technology/all");

export const getAllProjects = (
  search: string,
  categoryFilter: string,
  majorFilter: string,
  technologyFilter: string
) => getExploreData("project/all", {
  search,
  categoryFilter,
  majorFilter,
  technologyFilter,
});

export const getProjectById = (id: string) => getExploreData("project/detail", { id });
