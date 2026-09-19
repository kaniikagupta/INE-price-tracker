/**
 * REST API Client for INE Price Tracker Backend
 */
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const config = {
        ...options,
        headers
    };

    try {
        const res = await fetch(url, config);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const error = new Error(data.message || `Request failed with status ${res.status}`);
            error.status = res.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (err) {
        if (!err.status) {
            err.message = `Cannot connect to backend server at ${BASE_URL}. Ensure backend is running.`;
        }
        throw err;
    }
}

export const api = {
    // Health Check
    async checkHealth() {
        return request("/health");
    },

    // Catalog Search
    async searchProducts(query) {
        const q = encodeURIComponent(query || "");
        return request(`/products/search?q=${q}`);
    },

    // Tracking
    async trackProduct(productData) {
        return request("/products/track", {
            method: "POST",
            body: JSON.stringify(productData)
        });
    },

    async getTrackedProducts() {
        return request("/products/tracked");
    },

    async getProductById(id) {
        return request(`/products/${id}`);
    },

    async deleteProduct(id) {
        return request(`/products/${id}`, {
            method: "DELETE"
        });
    },

    // Price History & Logs
    async getPriceHistory(productId) {
        return request(`/products/${productId}/history`);
    },

    async getScrapeLogs(productId) {
        return request(`/products/${productId}/logs`);
    },

    // Manual Live Scrape Trigger
    async scrapeNow(productId) {
        return request(`/products/${productId}/scrape`, {
            method: "POST"
        });
    },

    // Update Frequency
    async updateFrequency(productId, frequencyMinutes) {
        return request(`/products/${productId}/frequency`, {
            method: "PATCH",
            body: JSON.stringify({ frequency_minutes: frequencyMinutes })
        });
    },

    // Scheduled Cron Trigger
    async triggerCronRun(secret) {
        return request("/scraper/run", {
            method: "POST",
            headers: {
                "x-cron-secret": secret
            }
        });
    }
};

export default api;
